#include "io.h"
#include "log.h"

#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
#include <poll.h>
#include <errno.h>
#include <fcntl.h>
#include <openssl/err.h>

int nexterm_read_exact(int fd, uint8_t* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        ssize_t n = read(fd, buf + total, len - total);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_write_exact(int fd, const uint8_t* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        ssize_t n = write(fd, buf + total, len - total);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_tcp_connect(const char* host, uint16_t port) {
    struct addrinfo hints = { .ai_family = AF_UNSPEC, .ai_socktype = SOCK_STREAM };

    char port_str[8];
    snprintf(port_str, sizeof(port_str), "%u", port);

    struct addrinfo* result;
    int ret = getaddrinfo(host, port_str, &hints, &result);
    if (ret != 0) {
        LOG_ERROR("getaddrinfo(%s:%s): %s", host, port_str, gai_strerror(ret));
        return -1;
    }

    int fd = -1;
    for (struct addrinfo* rp = result; rp; rp = rp->ai_next) {
        fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
        if (fd < 0) continue;
        if (connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) break;
        close(fd);
        fd = -1;
    }
    freeaddrinfo(result);

    if (fd < 0) {
        LOG_ERROR("Failed to connect to %s:%u", host, port);
        return -1;
    }

    int enable = 1;
    (void)setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &enable, sizeof(enable));
    (void)setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &enable, sizeof(enable));

    return fd;
}

SSL_CTX* nexterm_tls_client_ctx_create(void) {
    const SSL_METHOD* method = TLS_client_method();
    SSL_CTX* ctx = SSL_CTX_new(method);
    if (!ctx) {
        LOG_ERROR("Failed to create SSL_CTX");
        return NULL;
    }

    SSL_CTX_set_min_proto_version(ctx, TLS1_2_VERSION);

    SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, NULL);

    return ctx;
}

SSL* nexterm_tls_handshake(SSL_CTX* ctx, int fd) {
    SSL* ssl = SSL_new(ctx);
    if (!ssl) {
        LOG_ERROR("Failed to create SSL object");
        return NULL;
    }

    if (SSL_set_fd(ssl, fd) != 1) {
        LOG_ERROR("SSL_set_fd failed");
        SSL_free(ssl);
        return NULL;
    }

    int ret = SSL_connect(ssl);
    if (ret != 1) {
        int err = SSL_get_error(ssl, ret);
        char errbuf[256];
        ERR_error_string_n(ERR_get_error(), errbuf, sizeof(errbuf));
        LOG_ERROR("TLS handshake failed (err=%d): %s", err, errbuf);
        SSL_free(ssl);
        return NULL;
    }

    LOG_INFO("TLS handshake complete (protocol: %s, cipher: %s)",
             SSL_get_version(ssl), SSL_get_cipher_name(ssl));
    return ssl;
}

void nexterm_tls_cleanup(SSL* ssl) {
    if (!ssl) return;
    SSL_shutdown(ssl);
    SSL_free(ssl);
}

int nexterm_read_exact_s(int fd, SSL* ssl, uint8_t* buf, size_t len) {
    if (!ssl) return nexterm_read_exact(fd, buf, len);

    size_t total = 0;
    while (total < len) {
        int n = SSL_read(ssl, buf + total, (int)(len - total));
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_write_exact_s(int fd, SSL* ssl, const uint8_t* buf, size_t len) {
    if (!ssl) return nexterm_write_exact(fd, buf, len);

    size_t total = 0;
    while (total < len) {
        int n = SSL_write(ssl, buf + total, (int)(len - total));
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_send_frame_s(int fd, SSL* ssl, const uint8_t* data, size_t len,
                         pthread_mutex_t* mutex) {
    uint32_t header = htonl((uint32_t)len);

    if (mutex) pthread_mutex_lock(mutex);
    int ret = nexterm_write_exact_s(fd, ssl, (uint8_t*)&header, FRAME_HEADER_SIZE);
    if (ret == 0)
        ret = nexterm_write_exact_s(fd, ssl, data, len);
    if (mutex) pthread_mutex_unlock(mutex);

    return ret;
}

uint8_t* nexterm_read_frame_s(int fd, SSL* ssl, uint32_t max_size, uint32_t* out_len) {
    uint8_t header[FRAME_HEADER_SIZE];
    if (nexterm_read_exact_s(fd, ssl, header, FRAME_HEADER_SIZE) != 0)
        return NULL;

    uint32_t net_len;
    memcpy(&net_len, header, sizeof(net_len));
    uint32_t payload_len = ntohl(net_len);

    if (payload_len == 0 || payload_len > max_size) {
        LOG_ERROR("Invalid frame length: %u", payload_len);
        return NULL;
    }

    uint8_t* buf = malloc(payload_len);
    if (!buf) {
        LOG_ERROR("Failed to allocate %u bytes for frame", payload_len);
        return NULL;
    }

    if (nexterm_read_exact_s(fd, ssl, buf, payload_len) != 0) {
        free(buf);
        return NULL;
    }

    *out_len = payload_len;
    return buf;
}

typedef struct {
    SSL* ssl;
    int plain_fd;
    int tls_fd;
} tls_proxy_args_t;

static void* tls_proxy_thread(void* arg) {
    tls_proxy_args_t* a = (tls_proxy_args_t*)arg;
    char buf[8192];

    int flags = fcntl(a->tls_fd, F_GETFL, 0);
    if (flags >= 0)
        fcntl(a->tls_fd, F_SETFL, flags | O_NONBLOCK);

    struct pollfd fds[2] = {
        { .fd = a->plain_fd, .events = POLLIN },
        { .fd = a->tls_fd,   .events = POLLIN },
    };

    for (;;) {
        int has_pending = SSL_pending(a->ssl) > 0;
        int timeout = has_pending ? 0 : 200;

        int ret = poll(fds, 2, timeout);
        if (ret < 0 && errno != EINTR) break;

        if (fds[0].revents & POLLIN) {
            ssize_t n = read(a->plain_fd, buf, sizeof(buf));
            if (n <= 0) break;
            size_t total = 0;
            while (total < (size_t)n) {
                int w = SSL_write(a->ssl, buf + total, (int)((size_t)n - total));
                if (w > 0) {
                    total += (size_t)w;
                } else {
                    int err = SSL_get_error(a->ssl, w);
                    if (err == SSL_ERROR_WANT_WRITE || err == SSL_ERROR_WANT_READ) {
                        struct pollfd wpfd = { .fd = a->tls_fd, .events = POLLOUT };
                        poll(&wpfd, 1, 200);
                        continue;
                    }
                    goto done;
                }
            }
        }

        if ((fds[1].revents & POLLIN) || has_pending) {
            int n = SSL_read(a->ssl, buf, sizeof(buf));
            if (n <= 0) {
                int err = SSL_get_error(a->ssl, n);
                if (err == SSL_ERROR_WANT_READ || err == SSL_ERROR_WANT_WRITE)
                    continue;
                break;
            }
            if (nexterm_write_exact(a->plain_fd, (const uint8_t*)buf, (size_t)n) != 0)
                break;
        }

        if (fds[0].revents & (POLLERR | POLLHUP)) break;
        if (fds[1].revents & (POLLERR | POLLHUP)) break;
    }
done:

    close(a->plain_fd);
    SSL_shutdown(a->ssl);
    SSL_free(a->ssl);
    close(a->tls_fd);
    free(a);
    return NULL;
}

int nexterm_tls_proxy_start(SSL* ssl, int tls_fd) {
    int sv[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, sv) != 0) {
        LOG_ERROR("Failed to create socketpair for TLS proxy: %s", strerror(errno));
        return -1;
    }

    tls_proxy_args_t* args = malloc(sizeof(tls_proxy_args_t));
    if (!args) {
        close(sv[0]);
        close(sv[1]);
        return -1;
    }

    args->ssl = ssl;
    args->plain_fd = sv[0];
    args->tls_fd = tls_fd;

    pthread_t thread;
    if (pthread_create(&thread, NULL, tls_proxy_thread, args) != 0) {
        LOG_ERROR("Failed to start TLS proxy thread: %s", strerror(errno));
        free(args);
        close(sv[0]);
        close(sv[1]);
        return -1;
    }
    pthread_detach(thread);

    return sv[1];
}
