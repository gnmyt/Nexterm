#include "websocket.h"
#include "control_plane.h"
#include "io.h"
#include "log.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netdb.h>
#include <openssl/bio.h>
#include <openssl/err.h>
#include <openssl/rand.h>
#include <openssl/ssl.h>
#include <poll.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define WS_BUF_SIZE 65536
#define WS_HANDSHAKE_TIMEOUT_MS 10000

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} ws_thread_args_t;

static void base64_encode(const unsigned char* in, size_t in_len, char* out, size_t out_size) {
    BIO* b64 = BIO_new(BIO_f_base64());
    BIO* mem = BIO_new(BIO_s_mem());
    b64 = BIO_push(b64, mem);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, in, (int)in_len);
    (void)BIO_flush(b64);
    BUF_MEM* bptr;
    BIO_get_mem_ptr(b64, &bptr);
    size_t copy_len = bptr->length < out_size - 1 ? bptr->length : out_size - 1;
    memcpy(out, bptr->data, copy_len);
    out[copy_len] = '\0';
    BIO_free_all(b64);
}

static int parse_url(const char* url, char* host, size_t host_len,
                     char* port, size_t port_len,
                     char* path, size_t path_len,
                     bool* use_tls) {
    *use_tls = false;
    const char* p = url;

    if (strncmp(p, "wss://", 6) == 0) {
        *use_tls = true;
        p += 6;
    } else if (strncmp(p, "ws://", 5) == 0) {
        p += 5;
    } else {
        return -1;
    }

    const char* path_start = strchr(p, '/');
    const char* port_start = strchr(p, ':');

    size_t host_end;
    if (port_start && (!path_start || port_start < path_start)) {
        host_end = (size_t)(port_start - p);
        const char* pend = path_start ? path_start : p + strlen(p);
        size_t plen = (size_t)(pend - port_start - 1);
        if (plen >= port_len) plen = port_len - 1;
        memcpy(port, port_start + 1, plen);
        port[plen] = '\0';
    } else {
        host_end = path_start ? (size_t)(path_start - p) : strlen(p);
        snprintf(port, port_len, "%s", *use_tls ? "443" : "80");
    }

    if (host_end >= host_len) host_end = host_len - 1;
    memcpy(host, p, host_end);
    host[host_end] = '\0';

    if (path_start)
        snprintf(path, path_len, "%s", path_start);
    else
        snprintf(path, path_len, "/");

    return 0;
}

static int ssl_write_all(SSL* ssl, const void* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        int n = SSL_write(ssl, (const char*)buf + total, (int)(len - total));
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

static int plain_write_all(int fd, const void* buf, size_t len) {
    return nexterm_write_exact(fd, (const uint8_t*)buf, len);
}

typedef struct {
    SSL* ssl;
    int fd;
    bool tls;
} ws_conn_t;

static int ws_write(ws_conn_t* c, const void* buf, size_t len) {
    return c->tls ? ssl_write_all(c->ssl, buf, len) : plain_write_all(c->fd, buf, len);
}

static int ws_read(ws_conn_t* c, void* buf, size_t len) {
    if (c->tls)
        return SSL_read(c->ssl, buf, (int)len);
    else {
        ssize_t n = read(c->fd, buf, len);
        return (int)n;
    }
}

static int ws_send_frame(ws_conn_t* c, int opcode, const uint8_t* data, size_t len, bool mask) {
    uint8_t header[14];
    size_t hlen = 0;

    header[0] = (uint8_t)(0x80 | (opcode & 0x0F));

    if (len < 126) {
        header[1] = (uint8_t)(len | (mask ? 0x80 : 0));
        hlen = 2;
    } else if (len < 65536) {
        header[1] = 126 | (mask ? 0x80 : 0);
        header[2] = (uint8_t)((len >> 8) & 0xFF);
        header[3] = (uint8_t)(len & 0xFF);
        hlen = 4;
    } else {
        header[1] = 127 | (mask ? 0x80 : 0);
        for (int i = 0; i < 8; i++)
            header[2 + i] = (uint8_t)((len >> (56 - i * 8)) & 0xFF);
        hlen = 10;
    }

    uint8_t mask_key[4] = {0};
    if (mask) {
        RAND_bytes(mask_key, 4);
        memcpy(header + hlen, mask_key, 4);
        hlen += 4;
    }

    if (ws_write(c, header, hlen) != 0) return -1;

    if (len > 0 && data) {
        if (mask) {
            uint8_t* masked = malloc(len);
            if (!masked) return -1;
            for (size_t i = 0; i < len; i++)
                masked[i] = data[i] ^ mask_key[i % 4];
            int ret = ws_write(c, masked, len);
            free(masked);
            return ret;
        } else {
            return ws_write(c, data, len);
        }
    }

    return 0;
}

typedef struct {
    int opcode;
    uint8_t* payload;
    size_t payload_len;
    bool fin;
} ws_frame_t;

static int ws_read_frame(ws_conn_t* c, ws_frame_t* frame) {
    uint8_t h[2];
    int n = ws_read(c, h, 2);
    if (n <= 0) return -1;
    if (n < 2) return -1;

    frame->fin = (h[0] & 0x80) != 0;
    frame->opcode = h[0] & 0x0F;
    bool masked = (h[1] & 0x80) != 0;
    uint64_t payload_len = h[1] & 0x7F;

    if (payload_len == 126) {
        uint8_t ext[2];
        if (ws_read(c, ext, 2) < 2) return -1;
        payload_len = ((uint64_t)ext[0] << 8) | ext[1];
    } else if (payload_len == 127) {
        uint8_t ext[8];
        if (ws_read(c, ext, 8) < 8) return -1;
        payload_len = 0;
        for (int i = 0; i < 8; i++)
            payload_len = (payload_len << 8) | ext[i];
    }

    uint8_t mask_key[4] = {0};
    if (masked) {
        if (ws_read(c, mask_key, 4) < 4) return -1;
    }

    if (payload_len > 16 * 1024 * 1024) return -1;

    frame->payload = NULL;
    frame->payload_len = (size_t)payload_len;

    if (payload_len > 0) {
        frame->payload = malloc((size_t)payload_len);
        if (!frame->payload) return -1;

        size_t total = 0;
        while (total < (size_t)payload_len) {
            int r = ws_read(c, frame->payload + total, (size_t)payload_len - total);
            if (r <= 0) { free(frame->payload); return -1; }
            total += (size_t)r;
        }

        if (masked) {
            for (size_t i = 0; i < (size_t)payload_len; i++)
                frame->payload[i] ^= mask_key[i % 4];
        }
    }

    return 0;
}

static int ws_handshake(ws_conn_t* c, const char* host, const char* port,
                        const char* path, nexterm_session_t* session) {
    unsigned char nonce[16];
    RAND_bytes(nonce, 16);
    char ws_key[32];
    base64_encode(nonce, 16, ws_key, sizeof(ws_key));

    char request[4096];
    int off = snprintf(request, sizeof(request),
        "GET %s HTTP/1.1\r\n"
        "Host: %s:%s\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n",
        path, host, port, ws_key);

    for (int i = 0; i < session->param_count; i++) {
        if (strncmp(session->params[i].key, "ws_header_", 10) == 0) {
            const char* hdr_name = session->params[i].key + 10;
            off += snprintf(request + off, sizeof(request) - (size_t)off,
                           "%s: %s\r\n", hdr_name, session->params[i].value);
        }
    }

    off += snprintf(request + off, sizeof(request) - (size_t)off, "\r\n");

    if (ws_write(c, request, (size_t)off) != 0) {
        LOG_ERROR("WebSocket handshake write failed for session %s", session->session_id);
        return -1;
    }

    char response[4096];
    size_t resp_len = 0;
    bool header_done = false;

    while (!header_done && resp_len < sizeof(response) - 1) {
        int r = ws_read(c, response + resp_len, 1);
        if (r <= 0) {
            LOG_ERROR("WebSocket handshake read failed for session %s", session->session_id);
            return -1;
        }
        resp_len += (size_t)r;
        if (resp_len >= 4 &&
            response[resp_len - 4] == '\r' && response[resp_len - 3] == '\n' &&
            response[resp_len - 2] == '\r' && response[resp_len - 1] == '\n')
            header_done = true;
    }
    response[resp_len] = '\0';

    if (strstr(response, "101") == NULL) {
        LOG_ERROR("WebSocket handshake rejected for session %s: %.128s", session->session_id, response);
        return -1;
    }

    LOG_INFO("WebSocket handshake complete for session %s", session->session_id);
    return 0;
}

static void* websocket_session_thread(void* arg) {
    ws_thread_args_t* args = (ws_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;

    const char* url = nexterm_session_get_param(session, "ws_url");
    if (!url) {
        LOG_ERROR("WebSocket session %s: missing ws_url param", session->session_id);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Missing ws_url parameter", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    const char* insecure_str = nexterm_session_get_param(session, "ws_insecure");
    bool insecure = insecure_str && strcmp(insecure_str, "true") == 0;

    char host[256], port_str[8], path[2048];
    bool use_tls;
    if (parse_url(url, host, sizeof(host), port_str, sizeof(port_str),
                  path, sizeof(path), &use_tls) != 0) {
        LOG_ERROR("WebSocket session %s: invalid URL: %s", session->session_id, url);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Invalid WebSocket URL", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    session->state = SESSION_STATE_CONNECTING;

    int sock = nexterm_tcp_connect(host, (uint16_t)atoi(port_str));
    if (sock < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to WebSocket server", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    ws_conn_t conn = { .ssl = NULL, .fd = sock, .tls = use_tls };
    SSL_CTX* ssl_ctx = NULL;

    if (use_tls) {
        ssl_ctx = SSL_CTX_new(TLS_client_method());
        if (!ssl_ctx) {
            LOG_ERROR("WebSocket session %s: SSL_CTX_new failed", session->session_id);
            close(sock);
            nexterm_cp_send_session_result(cp, session->session_id, false,
                                           "TLS initialization failed", NULL);
            session->state = SESSION_STATE_CLOSED;
            free(args);
            return NULL;
        }

        if (insecure)
            SSL_CTX_set_verify(ssl_ctx, SSL_VERIFY_NONE, NULL);

        conn.ssl = SSL_new(ssl_ctx);
        SSL_set_fd(conn.ssl, sock);
        SSL_set_tlsext_host_name(conn.ssl, host);

        if (SSL_connect(conn.ssl) <= 0) {
            LOG_ERROR("WebSocket session %s: SSL handshake failed", session->session_id);
            SSL_free(conn.ssl);
            SSL_CTX_free(ssl_ctx);
            close(sock);
            nexterm_cp_send_session_result(cp, session->session_id, false,
                                           "TLS handshake failed", NULL);
            session->state = SESSION_STATE_CLOSED;
            free(args);
            return NULL;
        }
    }

    if (ws_handshake(&conn, host, port_str, path, session) != 0) {
        if (conn.tls) { SSL_shutdown(conn.ssl); SSL_free(conn.ssl); SSL_CTX_free(ssl_ctx); }
        close(sock);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "WebSocket handshake failed", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    int data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        if (conn.tls) { SSL_shutdown(conn.ssl); SSL_free(conn.ssl); SSL_CTX_free(ssl_ctx); }
        close(sock);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }
    session->data_fd = data_fd;

    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    LOG_INFO("WebSocket session %s active: %s", session->session_id, url);

    uint8_t buf[WS_BUF_SIZE];
    bool running = true;

    int ws_fd = sock;
    int ssl_pending;

    while (running && session->state == SESSION_STATE_ACTIVE) {
        struct pollfd fds[2];
        fds[0].fd = data_fd;
        fds[0].events = POLLIN;
        fds[1].fd = ws_fd;
        fds[1].events = POLLIN;

        ssl_pending = conn.tls ? SSL_pending(conn.ssl) : 0;
        int timeout = ssl_pending > 0 ? 0 : 200;

        int ret = poll(fds, 2, timeout);
        if (ret < 0) {
            if (errno == EINTR) continue;
            break;
        }

        if (fds[0].revents & POLLIN) {
            ssize_t n = read(data_fd, buf, sizeof(buf));
            if (n <= 0) break;
            if (ws_send_frame(&conn, 0x01, buf, (size_t)n, true) != 0) break;
        }
        if (fds[0].revents & (POLLERR | POLLHUP | POLLNVAL)) break;

        if ((fds[1].revents & POLLIN) || ssl_pending > 0) {
            ws_frame_t frame;
            if (ws_read_frame(&conn, &frame) != 0) break;

            if (frame.opcode == 0x08) {
                ws_send_frame(&conn, 0x08, NULL, 0, true);
                free(frame.payload);
                break;
            } else if (frame.opcode == 0x09) {
                ws_send_frame(&conn, 0x0A, frame.payload, frame.payload_len, true);
            } else if (frame.opcode == 0x01 || frame.opcode == 0x02 || frame.opcode == 0x00) {
                if (frame.payload && frame.payload_len > 0) {
                    if (nexterm_write_exact(data_fd, frame.payload, frame.payload_len) != 0) {
                        free(frame.payload);
                        break;
                    }
                }
            }
            free(frame.payload);
        }
        if (fds[1].revents & (POLLERR | POLLHUP | POLLNVAL)) break;
    }

    LOG_INFO("WebSocket session %s ending", session->session_id);

    ws_send_frame(&conn, 0x08, NULL, 0, true);

    if (conn.tls) {
        SSL_shutdown(conn.ssl);
        SSL_free(conn.ssl);
        SSL_CTX_free(ssl_ctx);
    }
    close(sock);
    close(data_fd);
    session->data_fd = -1;

    session->state = SESSION_STATE_CLOSED;
    nexterm_cp_send_session_closed(cp, session->session_id, "websocket session ended");

    free(args);
    return NULL;
}

int nexterm_websocket_start(nexterm_session_t* session,
                            nexterm_control_plane_t* cp) {
    ws_thread_args_t* args = calloc(1, sizeof(ws_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, websocket_session_thread, args) != 0) {
        LOG_ERROR("Failed to create WebSocket thread for session %s", session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}
