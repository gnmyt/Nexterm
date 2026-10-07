#define _GNU_SOURCE

#include "web.h"

#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sched.h>
#include <sys/wait.h>
#include <unistd.h>

#include <openssl/evp.h>
#include <openssl/rand.h>

#include <guacamole/client.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include "control_plane.h"
#include "io.h"
#include "log.h"
#include "ssh.h"
#include "ssh_common.h"

#define WEB_VNC_PORT_MIN 5920
#define WEB_VNC_PORT_MAX 5939

#define WEB_MAX_PROXY_CONNS 64
#define WEB_PROXY_BUF_SIZE 32768
#define WEB_HEAD_MAX 8192
#define WEB_BROWSER_START_TIMEOUT_MS 20000
#define WEB_PROXY_USERNAME "nexterm"
#define WEB_SESSION_ROOT "/tmp/nexterm-web"
#define WEB_DEFAULT_GEOMETRY "1280x720"

#define WEB_PIPE_NAME "nexterm-browser"
#define WEB_FAVICON_PREFIX "{\"event\":\"favicon\""
#define WEB_COMMAND_MAX 4096
#define WEB_EVENT_MAX 8192
#define WEB_EVENT_LINE_MAX 65536

static const char* binary_path(const char* env_name, const char* fallback) {
    const char* override = getenv(env_name);
    return (override && *override) ? override : fallback;
}

static bool sibling_binary(const char* name, char* out, size_t out_sz) {
    char self[512];
    ssize_t len = readlink("/proc/self/exe", self, sizeof(self) - 1);
    if (len <= 0) return false;
    self[len] = '\0';

    char* slash = strrchr(self, '/');
    if (!slash) return false;
    *slash = '\0';

    snprintf(out, out_sz, "%s/%s", self, name);
    return access(out, X_OK) == 0;
}

static bool binary_available(const char* binary) {
    if (strchr(binary, '/') != NULL) return access(binary, X_OK) == 0;

    const char* path = getenv("PATH");
    if (!path || !*path) path = "/usr/local/bin:/usr/bin:/bin";

    char* copy = strdup(path);
    if (!copy) return true;

    bool found = false;
    for (char* dir = strtok(copy, ":"); dir && !found; dir = strtok(NULL, ":")) {
        char candidate[512];
        snprintf(candidate, sizeof(candidate), "%s/%s", dir, binary);
        found = access(candidate, X_OK) == 0;
    }

    free(copy);
    return found;
}

typedef enum {
    PROXY_STATE_HEAD,
    PROXY_STATE_RELAY,
} proxy_state_t;

typedef struct {
    int fd;
    proxy_state_t state;
    LIBSSH2_CHANNEL* channel;

    char head[WEB_HEAD_MAX];
    size_t head_len;

    char to_ssh[WEB_PROXY_BUF_SIZE];
    size_t to_ssh_len, to_ssh_off;

    char to_client[WEB_PROXY_BUF_SIZE];
    size_t to_client_len, to_client_off;

    bool client_eof;
    bool channel_eof;
} proxy_conn_t;

typedef struct {
    LIBSSH2_SESSION* ssh;
    int ssh_sock;
    jump_chain_t jump_chain;

    int listen_fd;
    uint16_t proxy_port;
    uint16_t vnc_port;

    pid_t webview_pid;
    pid_t xvnc_pid;
    uint16_t display_number;

    int cmd_fd;
    int evt_fd;

    char base_dir[128];
    char runtime_dir[128];
    char profile_dir[128];
    char config_dir[128];
    char child_path[512];

    char proxy_password[33];
    char proxy_auth_header[192];
    char session_id[MAX_SESSION_ID_LEN];

    struct nexterm_control_plane* cp;
    guac_client* guac_client;

    pthread_mutex_t state_mutex;
    char last_state[WEB_EVENT_MAX];
    char* last_favicon;

    guac_client_join_pending_handler* prev_join_pending;

    char event_buf[WEB_EVENT_LINE_MAX];

    pthread_t proxy_thread;
    pthread_t event_thread;
    bool proxy_thread_active;
    bool event_thread_active;

    pthread_mutex_t cmd_mutex;
    volatile bool stop;

    proxy_conn_t conns[WEB_MAX_PROXY_CONNS];
} web_ctx_t;

static pthread_mutex_t g_ctx_mutex = PTHREAD_MUTEX_INITIALIZER;
static web_ctx_t* g_contexts[WEB_VNC_PORT_MAX - WEB_VNC_PORT_MIN + 1];

static void web_ctx_register(web_ctx_t* ctx) {
    pthread_mutex_lock(&g_ctx_mutex);
    for (size_t i = 0; i < sizeof(g_contexts) / sizeof(g_contexts[0]); i++) {
        if (g_contexts[i]) continue;
        g_contexts[i] = ctx;
        break;
    }
    pthread_mutex_unlock(&g_ctx_mutex);
}

static void web_ctx_unregister(web_ctx_t* ctx) {
    pthread_mutex_lock(&g_ctx_mutex);
    for (size_t i = 0; i < sizeof(g_contexts) / sizeof(g_contexts[0]); i++) {
        if (g_contexts[i] == ctx) g_contexts[i] = NULL;
    }
    pthread_mutex_unlock(&g_ctx_mutex);
}

static web_ctx_t* web_ctx_for_client(const guac_client* client) {
    web_ctx_t* found = NULL;

    pthread_mutex_lock(&g_ctx_mutex);
    for (size_t i = 0; i < sizeof(g_contexts) / sizeof(g_contexts[0]); i++) {
        if (g_contexts[i] && g_contexts[i]->guac_client == client) {
            found = g_contexts[i];
            break;
        }
    }
    pthread_mutex_unlock(&g_ctx_mutex);

    return found;
}

static pthread_mutex_t g_port_mutex = PTHREAD_MUTEX_INITIALIZER;
static bool g_port_taken[WEB_VNC_PORT_MAX - WEB_VNC_PORT_MIN + 1];

static uint16_t reserve_vnc_port(void) {
    uint16_t port = 0;

    pthread_mutex_lock(&g_port_mutex);
    for (int i = 0; i <= WEB_VNC_PORT_MAX - WEB_VNC_PORT_MIN; i++) {
        if (g_port_taken[i]) continue;

        uint16_t candidate = (uint16_t)(WEB_VNC_PORT_MIN + i);
        int probe = socket(AF_INET, SOCK_STREAM, 0);
        if (probe < 0) break;

        int one = 1;
        setsockopt(probe, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

        struct sockaddr_in addr = {0};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = htons(candidate);

        bool free_port = bind(probe, (struct sockaddr*)&addr, sizeof(addr)) == 0;
        close(probe);

        if (free_port) {
            g_port_taken[i] = true;
            port = candidate;
            break;
        }
    }
    pthread_mutex_unlock(&g_port_mutex);

    return port;
}

static void release_vnc_port(uint16_t port) {
    if (port < WEB_VNC_PORT_MIN || port > WEB_VNC_PORT_MAX) return;

    pthread_mutex_lock(&g_port_mutex);
    g_port_taken[port - WEB_VNC_PORT_MIN] = false;
    pthread_mutex_unlock(&g_port_mutex);
}

static int set_nonblocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags < 0) return -1;
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

static int build_proxy_credential(web_ctx_t* ctx) {
    unsigned char random_bytes[16];
    if (RAND_bytes(random_bytes, sizeof(random_bytes)) != 1) return -1;

    for (size_t i = 0; i < sizeof(random_bytes); i++)
        snprintf(ctx->proxy_password + i * 2, 3, "%02x", random_bytes[i]);

    char userinfo[64];
    int userinfo_len = snprintf(userinfo, sizeof(userinfo), "%s:%s",
                                WEB_PROXY_USERNAME, ctx->proxy_password);

    char encoded[128];
    int encoded_len = EVP_EncodeBlock((unsigned char*)encoded, (const unsigned char*)userinfo,
                                      userinfo_len);
    if (encoded_len <= 0) return -1;

    snprintf(ctx->proxy_auth_header, sizeof(ctx->proxy_auth_header), "Basic %s", encoded);
    return 0;
}

static bool proxy_request_authorized(const proxy_conn_t* conn, const web_ctx_t* ctx) {
    const char* cursor = conn->head;

    while ((cursor = strchr(cursor, '\n')) != NULL) {
        cursor++;
        if (strncasecmp(cursor, "Proxy-Authorization:", 20) != 0) continue;

        cursor += 20;
        while (*cursor == ' ' || *cursor == '\t') cursor++;

        size_t len = strlen(ctx->proxy_auth_header);
        if (strncmp(cursor, ctx->proxy_auth_header, len) != 0) return false;

        return cursor[len] == '\r' || cursor[len] == '\n' || cursor[len] == '\0';
    }

    return false;
}

static void proxy_conn_reset(proxy_conn_t* conn) {
    if (conn->channel) {
        libssh2_channel_free(conn->channel);
        conn->channel = NULL;
    }
    if (conn->fd >= 0) {
        close(conn->fd);
        conn->fd = -1;
    }
    conn->state = PROXY_STATE_HEAD;
    conn->head_len = 0;
    conn->to_ssh_len = conn->to_ssh_off = 0;
    conn->to_client_len = conn->to_client_off = 0;
    conn->client_eof = false;
    conn->channel_eof = false;
}

static void queue_to_client(proxy_conn_t* conn, const char* text, size_t len) {
    if (conn->to_client_len + len > sizeof(conn->to_client)) return;
    memcpy(conn->to_client + conn->to_client_len, text, len);
    conn->to_client_len += len;
}

static int parse_request_head(proxy_conn_t* conn, char* out_host, size_t host_sz,
                              uint16_t* out_port, bool* out_is_connect) {
    char* head_end = strstr(conn->head, "\r\n\r\n");
    if (!head_end) return -1;

    size_t head_size = (size_t)(head_end - conn->head) + 4;
    char* body = conn->head + head_size;
    size_t body_len = conn->head_len - head_size;

    char* line_end = strstr(conn->head, "\r\n");
    if (!line_end) return -1;
    *line_end = '\0';

    char method[16] = {0};
    char target[2048] = {0};
    if (sscanf(conn->head, "%15s %2047s", method, target) != 2) return -1;

    *out_is_connect = strcmp(method, "CONNECT") == 0;

    const char* authority;
    const char* path = "/";

    if (*out_is_connect) {
        authority = target;
    } else {
        const char* scheme_end = strstr(target, "://");
        if (!scheme_end) return -1;
        authority = scheme_end + 3;

        const char* slash = strchr(authority, '/');
        if (slash) path = slash;
    }

    /* Split the authority into host and port, tolerating an IPv6 literal. */
    char authority_buf[512];
    size_t authority_len = 0;
    while (authority[authority_len] && authority[authority_len] != '/' &&
           authority_len < sizeof(authority_buf) - 1) {
        authority_buf[authority_len] = authority[authority_len];
        authority_len++;
    }
    authority_buf[authority_len] = '\0';

    char* port_sep = strrchr(authority_buf, ':');
    if (authority_buf[0] == '[') {
        char* bracket = strchr(authority_buf, ']');
        if (!bracket) return -1;
        port_sep = (*(bracket + 1) == ':') ? bracket + 1 : NULL;
        *bracket = '\0';
        snprintf(out_host, host_sz, "%s", authority_buf + 1);
    } else {
        if (port_sep) *port_sep = '\0';
        snprintf(out_host, host_sz, "%s", authority_buf);
    }

    if (port_sep) {
        int parsed = atoi(port_sep + 1);
        if (parsed <= 0 || parsed > 65535) return -1;
        *out_port = (uint16_t)parsed;
    } else {
        *out_port = *out_is_connect ? 443 : 80;
    }

    if (out_host[0] == '\0') return -1;
    if (*out_is_connect) return 0;

    char rebuilt[WEB_HEAD_MAX];
    int written = snprintf(rebuilt, sizeof(rebuilt), "%s %s HTTP/1.1\r\n", method, path);
    if (written < 0 || (size_t)written >= sizeof(rebuilt)) return -1;

    char* cursor = line_end + 2;
    while (cursor < head_end) {
        char* next = strstr(cursor, "\r\n");
        if (!next) break;
        size_t len = (size_t)(next - cursor);

        if (len > 0 && strncasecmp(cursor, "proxy-", 6) != 0) {
            if ((size_t)written + len + 2 >= sizeof(rebuilt)) return -1;
            memcpy(rebuilt + written, cursor, len);
            written += (int)len;
            rebuilt[written++] = '\r';
            rebuilt[written++] = '\n';
        }

        cursor = next + 2;
    }

    if ((size_t)written + 2 + body_len > sizeof(conn->to_ssh)) return -1;
    rebuilt[written++] = '\r';
    rebuilt[written++] = '\n';

    memcpy(conn->to_ssh, rebuilt, (size_t)written);
    conn->to_ssh_len = (size_t)written;

    if (body_len > 0) {
        memcpy(conn->to_ssh + conn->to_ssh_len, body, body_len);
        conn->to_ssh_len += body_len;
    }

    return 0;
}

static int proxy_open_channel(web_ctx_t* ctx, proxy_conn_t* conn,
                              const char* host, uint16_t port, bool is_connect) {
    LIBSSH2_CHANNEL* channel = NULL;

    for (;;) {
        channel = libssh2_channel_direct_tcpip_ex(ctx->ssh, host, port, "127.0.0.1", 0);
        if (channel) break;

        int err = libssh2_session_last_errno(ctx->ssh);
        if (err != LIBSSH2_ERROR_EAGAIN) {
            LOG_WARN("Web session %s: direct-tcpip to %s:%u failed (%d)",
                     ctx->session_id, host, port, err);

            const char* body =
                "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n"
                "Connection: close\r\n\r\n";
            queue_to_client(conn, body, strlen(body));
            conn->channel_eof = true;
            conn->state = PROXY_STATE_RELAY;
            return -1;
        }

        struct pollfd pfd = {.fd = ctx->ssh_sock, .events = POLLIN | POLLOUT};
        if (poll(&pfd, 1, 100) < 0 && errno != EINTR) return -1;
        if (ctx->stop) return -1;
    }

    conn->channel = channel;
    conn->state = PROXY_STATE_RELAY;

    if (is_connect) {
        const char* ok = "HTTP/1.1 200 Connection Established\r\n\r\n";
        queue_to_client(conn, ok, strlen(ok));
    }

    LOG_DEBUG("Web session %s: tunnelling %s %s:%u",
              ctx->session_id, is_connect ? "CONNECT" : "HTTP", host, port);
    return 0;
}

static void proxy_accept(web_ctx_t* ctx) {
    int fd = accept(ctx->listen_fd, NULL, NULL);
    if (fd < 0) return;

    for (int i = 0; i < WEB_MAX_PROXY_CONNS; i++) {
        if (ctx->conns[i].fd >= 0) continue;

        proxy_conn_reset(&ctx->conns[i]);
        ctx->conns[i].fd = fd;
        set_nonblocking(fd);
        return;
    }

    LOG_WARN("Web session %s: proxy connection table full", ctx->session_id);
    close(fd);
}

static void proxy_read_client(web_ctx_t* ctx, proxy_conn_t* conn) {
    if (conn->state == PROXY_STATE_HEAD) {
        if (conn->head_len >= sizeof(conn->head) - 1) {
            proxy_conn_reset(conn);
            return;
        }

        ssize_t n = read(conn->fd, conn->head + conn->head_len,
                         sizeof(conn->head) - conn->head_len - 1);
        if (n < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) return;
            proxy_conn_reset(conn);
            return;
        }
        if (n == 0) {
            proxy_conn_reset(conn);
            return;
        }

        conn->head_len += (size_t)n;
        conn->head[conn->head_len] = '\0';

        if (!strstr(conn->head, "\r\n\r\n")) return;

        if (!proxy_request_authorized(conn, ctx)) {
            const char* challenge =
                "HTTP/1.1 407 Proxy Authentication Required\r\n"
                "Proxy-Authenticate: Basic realm=\"Nexterm\"\r\n"
                "Content-Length: 0\r\n"
                "Proxy-Connection: keep-alive\r\n\r\n";
            queue_to_client(conn, challenge, strlen(challenge));
            conn->head_len = 0;
            return;
        }

        char host[256] = {0};
        uint16_t port = 0;
        bool is_connect = false;

        if (parse_request_head(conn, host, sizeof(host), &port, &is_connect) != 0) {
            LOG_WARN("Web session %s: malformed proxy request", ctx->session_id);
            proxy_conn_reset(conn);
            return;
        }

        proxy_open_channel(ctx, conn, host, port, is_connect);
        return;
    }

    if (conn->to_ssh_len > 0 || conn->client_eof) return;

    ssize_t n = read(conn->fd, conn->to_ssh, sizeof(conn->to_ssh));
    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) return;
        conn->client_eof = true;
        return;
    }
    if (n == 0) {
        conn->client_eof = true;
        return;
    }

    conn->to_ssh_len = (size_t)n;
    conn->to_ssh_off = 0;
}

static void proxy_pump(proxy_conn_t* conn) {
    if (!conn->channel) return;

    while (conn->to_ssh_off < conn->to_ssh_len) {
        ssize_t n = libssh2_channel_write(conn->channel,
                                          conn->to_ssh + conn->to_ssh_off,
                                          conn->to_ssh_len - conn->to_ssh_off);
        if (n == LIBSSH2_ERROR_EAGAIN) break;
        if (n < 0) {
            conn->channel_eof = true;
            return;
        }
        conn->to_ssh_off += (size_t)n;
    }

    if (conn->to_ssh_off >= conn->to_ssh_len) {
        conn->to_ssh_len = conn->to_ssh_off = 0;

        if (conn->client_eof && conn->channel) libssh2_channel_send_eof(conn->channel);
    }

    while (conn->to_client_len < sizeof(conn->to_client)) {
        ssize_t n = libssh2_channel_read(conn->channel,
                                         conn->to_client + conn->to_client_len,
                                         sizeof(conn->to_client) - conn->to_client_len);
        if (n == LIBSSH2_ERROR_EAGAIN) break;
        if (n < 0) {
            conn->channel_eof = true;
            break;
        }
        if (n == 0) {
            if (libssh2_channel_eof(conn->channel)) conn->channel_eof = true;
            break;
        }
        conn->to_client_len += (size_t)n;
    }
}

static void proxy_write_client(proxy_conn_t* conn) {
    while (conn->to_client_off < conn->to_client_len) {
        ssize_t n = write(conn->fd, conn->to_client + conn->to_client_off,
                          conn->to_client_len - conn->to_client_off);
        if (n < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) return;
            proxy_conn_reset(conn);
            return;
        }
        conn->to_client_off += (size_t)n;
    }

    conn->to_client_len = conn->to_client_off = 0;
}

static void* proxy_thread_main(void* arg) {
    web_ctx_t* ctx = arg;

    while (!ctx->stop) {
        struct pollfd fds[WEB_MAX_PROXY_CONNS + 2];
        int conn_index[WEB_MAX_PROXY_CONNS];
        nfds_t nfds = 0;

        fds[nfds].fd = ctx->listen_fd;
        fds[nfds].events = POLLIN;
        fds[nfds].revents = 0;
        nfds++;

        fds[nfds].fd = ctx->ssh_sock;
        fds[nfds].events = POLLIN;
        fds[nfds].revents = 0;
        nfds++;

        for (int i = 0; i < WEB_MAX_PROXY_CONNS; i++) {
            proxy_conn_t* conn = &ctx->conns[i];
            if (conn->fd < 0) continue;

            short events = 0;
            if (conn->state == PROXY_STATE_HEAD ||
                (conn->to_ssh_len == 0 && !conn->client_eof)) {
                events |= POLLIN;
            }
            if (conn->to_client_off < conn->to_client_len) events |= POLLOUT;

            conn_index[nfds - 2] = i;
            fds[nfds].fd = conn->fd;
            fds[nfds].events = events;
            fds[nfds].revents = 0;
            nfds++;
        }

        int ret = poll(fds, nfds, 50);
        if (ret < 0) {
            if (errno == EINTR) continue;
            break;
        }

        if (ctx->stop) break;

        if (fds[0].revents & POLLIN) proxy_accept(ctx);

        for (nfds_t i = 2; i < nfds; i++) {
            proxy_conn_t* conn = &ctx->conns[conn_index[i - 2]];
            if (conn->fd < 0) continue;

            if (fds[i].revents & (POLLERR | POLLNVAL)) {
                proxy_conn_reset(conn);
                continue;
            }
            if (fds[i].revents & (POLLIN | POLLHUP)) proxy_read_client(ctx, conn);
        }

        for (int i = 0; i < WEB_MAX_PROXY_CONNS; i++) {
            proxy_conn_t* conn = &ctx->conns[i];
            if (conn->fd < 0) continue;

            if (conn->state == PROXY_STATE_RELAY) proxy_pump(conn);
            if (conn->fd >= 0) proxy_write_client(conn);

            if (conn->fd < 0) continue;

            bool drained = conn->to_client_off >= conn->to_client_len;
            if (conn->channel_eof && drained) proxy_conn_reset(conn);
            else if (conn->client_eof && conn->to_ssh_len == 0 && conn->channel_eof) proxy_conn_reset(conn);
        }
    }

    for (int i = 0; i < WEB_MAX_PROXY_CONNS; i++) proxy_conn_reset(&ctx->conns[i]);

    return NULL;
}

static void web_send_line(guac_client* client, guac_socket* socket, const char* line) {
    guac_stream* stream = guac_client_alloc_stream(client);
    if (!stream) return;

    guac_protocol_send_pipe(socket, stream, "application/json", WEB_PIPE_NAME);
    guac_protocol_send_blob(socket, stream, line, (int) strlen(line));
    guac_protocol_send_end(socket, stream);
    guac_socket_flush(socket);
    guac_client_free_stream(client, stream);
}

static void web_send_event(web_ctx_t* ctx, const char* line) {
    bool is_favicon = strncmp(line, WEB_FAVICON_PREFIX, sizeof(WEB_FAVICON_PREFIX) - 1) == 0;

    pthread_mutex_lock(&ctx->state_mutex);
    if (is_favicon) {
        free(ctx->last_favicon);
        ctx->last_favicon = strdup(line);
    } else {
        snprintf(ctx->last_state, sizeof(ctx->last_state), "%s", line);
    }
    pthread_mutex_unlock(&ctx->state_mutex);

    guac_client* client = ctx->guac_client;
    if (client) web_send_line(client, client->socket, line);
}

static int web_join_pending_handler(guac_client* client) {
    web_ctx_t* ctx = web_ctx_for_client(client);
    if (!ctx) return 0;

    if (ctx->prev_join_pending && ctx->prev_join_pending(client)) return 1;

    pthread_mutex_lock(&ctx->state_mutex);
    char state[WEB_EVENT_MAX];
    snprintf(state, sizeof(state), "%s", ctx->last_state);
    char* favicon = ctx->last_favicon ? strdup(ctx->last_favicon) : NULL;
    pthread_mutex_unlock(&ctx->state_mutex);

    LOG_DEBUG("Web session %s: joining user gets state=%s favicon=%s",
              ctx->session_id, state[0] ? "yes" : "EMPTY", favicon ? "yes" : "none");

    if (state[0]) web_send_line(client, client->pending_socket, state);
    if (favicon) {
        web_send_line(client, client->pending_socket, favicon);
        free(favicon);
    }

    return 0;
}

static bool web_command_allowed(const char* command) {
    if (!strcmp(command, "back") || !strcmp(command, "forward") ||
        !strcmp(command, "reload") || !strcmp(command, "stop"))
        return true;

    if (!strncmp(command, "navigate ", 9)) {
        const char* uri = command + 9;
        return *uri != '\0' && strlen(uri) <= 2048 && strpbrk(uri, "\r\n") == NULL;
    }

    if (!strncmp(command, "clipboard ", 10)) {
        const char* encoded = command + 10;
        size_t len = strlen(encoded);
        if (len == 0 || len > 262144) return false;
        for (size_t i = 0; i < len; i++) {
            char c = encoded[i];
            if (!isalnum((unsigned char) c) && c != '+' && c != '/' && c != '=') return false;
        }
        return true;
    }

    return false;
}

static int web_write_command(web_ctx_t* ctx, const char* command);

typedef struct {
    web_ctx_t* ctx;
    char data[WEB_COMMAND_MAX];
    size_t length;
    bool overflowed;
} web_pipe_buffer_t;

static int web_pipe_blob(guac_user* user, guac_stream* stream, void* data, int length) {
    web_pipe_buffer_t* buffer = stream->data;
    (void) user;

    if (buffer && length > 0) {
        if (buffer->length + (size_t) length >= sizeof(buffer->data)) buffer->overflowed = true;
        else {
            memcpy(buffer->data + buffer->length, data, (size_t) length);
            buffer->length += (size_t) length;
        }
    }

    return 0;
}

static int web_pipe_end(guac_user* user, guac_stream* stream) {
    web_pipe_buffer_t* buffer = stream->data;
    if (!buffer) return 0;

    buffer->data[buffer->length] = '\0';

    if (buffer->overflowed)
        guac_user_log(user, GUAC_LOG_WARNING, "Browser command discarded: too long");
    else if (!web_command_allowed(buffer->data))
        guac_user_log(user, GUAC_LOG_WARNING, "Browser command rejected");
    else if (web_write_command(buffer->ctx, buffer->data) != 0)
        guac_user_log(user, GUAC_LOG_WARNING, "Browser command could not be delivered");

    free(buffer);
    stream->data = NULL;
    return 0;
}

int nexterm_web_pipe_handler(guac_user* user, guac_stream* stream,
                             char* mimetype, char* name) {
    (void) mimetype;

    web_ctx_t* ctx = web_ctx_for_client(user->client);
    if (!ctx || strcmp(name, WEB_PIPE_NAME) != 0) {
        guac_protocol_send_ack(user->socket, stream, "Unsupported pipe",
                               GUAC_PROTOCOL_STATUS_UNSUPPORTED);
        guac_socket_flush(user->socket);
        return 0;
    }

    web_pipe_buffer_t* buffer = calloc(1, sizeof(web_pipe_buffer_t));
    if (!buffer) {
        guac_protocol_send_ack(user->socket, stream, "Out of memory",
                               GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    buffer->ctx = ctx;
    stream->data = buffer;
    stream->blob_handler = web_pipe_blob;
    stream->end_handler = web_pipe_end;

    guac_protocol_send_ack(user->socket, stream, "OK", GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;
}

static void* event_thread_main(void* arg) {
    web_ctx_t* ctx = arg;
    char* buf = ctx->event_buf;
    size_t len = 0;

    while (!ctx->stop) {
        struct pollfd pfd = {.fd = ctx->evt_fd, .events = POLLIN};
        int ret = poll(&pfd, 1, 200);
        if (ret < 0) {
            if (errno == EINTR) continue;
            break;
        }
        if (ret == 0) continue;
        if (pfd.revents & (POLLERR | POLLNVAL)) break;

        ssize_t n = read(ctx->evt_fd, buf + len, sizeof(ctx->event_buf) - len - 1);
        if (n < 0) {
            if (errno == EAGAIN || errno == EINTR) continue;
            break;
        }
        if (n == 0) break;

        len += (size_t)n;
        buf[len] = '\0';

        char* start = buf;
        char* newline;
        while ((newline = strchr(start, '\n')) != NULL) {
            *newline = '\0';
            if (*start != '\0') web_send_event(ctx, start);
            start = newline + 1;
        }

        len = strlen(start);
        memmove(buf, start, len + 1);

        if (len >= sizeof(ctx->event_buf) - 1) len = 0;
    }

    return NULL;
}

static char* env_dup(const char* key, const char* value) {
    size_t len = strlen(key) + strlen(value) + 2;
    char* entry = malloc(len);
    if (entry) snprintf(entry, len, "%s=%s", key, value);
    return entry;
}

static void env_free(char** envp) {
    for (int i = 0; envp[i]; i++) free(envp[i]);
}

static bool user_namespaces_available(void) {
    pid_t pid = fork();
    if (pid < 0) return true;

    if (pid == 0) _exit(unshare(CLONE_NEWUSER) == 0 ? 0 : 1);

    int status = 0;
    if (waitpid(pid, &status, 0) != pid) return true;
    return WIFEXITED(status) && WEXITSTATUS(status) == 0;
}

static int build_browser_env(const web_ctx_t* ctx, char** envp, int max_entries) {
    char display[16];
    snprintf(display, sizeof(display), ":%u", ctx->display_number);

    const char* pairs[][2] = {
        {"DISPLAY", display},
        {"XDG_RUNTIME_DIR", ctx->runtime_dir},
        {"XDG_CONFIG_HOME", ctx->config_dir},
        {"HOME", ctx->profile_dir},
        {"PATH", ctx->child_path},
        {"GDK_BACKEND", "x11"},
        {"LIBGL_ALWAYS_SOFTWARE", "1"},
        {"WEBKIT_DISABLE_COMPOSITING_MODE", "1"},
        {"WEBKIT_DISABLE_DMABUF_RENDERER", "1"},
        {"GSK_RENDERER", "cairo"},
    };

    bool sandboxed = user_namespaces_available();
    if (!sandboxed)
        LOG_WARN("User namespaces are unavailable, starting the browser without WebKit's sandbox");

    int count = 0;
    int total = (int)(sizeof(pairs) / sizeof(pairs[0]));
    for (int i = 0; i < total && count < max_entries - 1; i++) {
        envp[count] = env_dup(pairs[i][0], pairs[i][1]);
        if (!envp[count]) {
            env_free(envp);
            return -1;
        }
        count++;
    }

    if (!sandboxed && count < max_entries - 1) {
        envp[count] = env_dup("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");
        if (!envp[count]) {
            env_free(envp);
            return -1;
        }
        count++;
    }

    envp[count] = NULL;
    return 0;
}

static int wait_for_port(uint16_t port, int timeout_ms) {
    for (int waited = 0; waited < timeout_ms; waited += 100) {
        int fd = socket(AF_INET, SOCK_STREAM, 0);
        if (fd < 0) return -1;

        struct sockaddr_in addr = {0};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = htons(port);

        int ok = connect(fd, (struct sockaddr*)&addr, sizeof(addr));
        close(fd);
        if (ok == 0) return 0;

        struct timespec delay = {.tv_sec = 0, .tv_nsec = 100 * 1000 * 1000};
        nanosleep(&delay, NULL);
    }

    return -1;
}

static pid_t spawn_child(const char* const* argv, char* const* envp,
                         int stdin_fd, int stdout_fd) {
    pid_t pid = fork();
    if (pid < 0) return -1;

    if (pid == 0) {
        setsid();

        if (stdin_fd >= 0) dup2(stdin_fd, STDIN_FILENO);
        else {
            int devnull = open("/dev/null", O_RDONLY);
            if (devnull >= 0) dup2(devnull, STDIN_FILENO);
        }

        if (stdout_fd >= 0) dup2(stdout_fd, STDOUT_FILENO);

        for (int fd = 3; fd < 256; fd++) close(fd);

        execvpe(argv[0], (char* const*)argv, envp);
        _exit(127);
    }

    return pid;
}

static void kill_group(pid_t pid, int sig) {
    if (pid <= 0) return;
    kill(-pid, sig);
    kill(pid, sig);
}

static void reap_child(pid_t pid, int timeout_ms) {
    if (pid <= 0) return;

    for (int waited = 0; waited < timeout_ms; waited += 50) {
        int status = 0;
        pid_t done = waitpid(pid, &status, WNOHANG);
        if (done == pid || (done < 0 && errno == ECHILD)) return;

        struct timespec delay = {.tv_sec = 0, .tv_nsec = 50 * 1000 * 1000};
        nanosleep(&delay, NULL);
    }

    kill_group(pid, SIGKILL);
    waitpid(pid, NULL, 0);
}

static void remove_tree(const char* path) {
    char command[512];
    snprintf(command, sizeof(command), "rm -rf '%s'", path);
    if (system(command) != 0)
        LOG_DEBUG("Web session cleanup: could not remove %s", path);
}

static pthread_once_t g_sweep_once = PTHREAD_ONCE_INIT;

static void sweep_stale_sessions(void) {
    remove_tree(WEB_SESSION_ROOT);
}

static void web_ctx_free(web_ctx_t* ctx) {
    if (!ctx) return;

    ctx->stop = true;
    web_ctx_unregister(ctx);

    pthread_mutex_lock(&ctx->cmd_mutex);
    if (ctx->cmd_fd >= 0) {
        close(ctx->cmd_fd);
        ctx->cmd_fd = -1;
    }
    pthread_mutex_unlock(&ctx->cmd_mutex);

    kill_group(ctx->webview_pid, SIGTERM);
    kill_group(ctx->xvnc_pid, SIGTERM);

    if (ctx->event_thread_active) pthread_join(ctx->event_thread, NULL);
    if (ctx->proxy_thread_active) pthread_join(ctx->proxy_thread, NULL);

    reap_child(ctx->webview_pid, 3000);
    reap_child(ctx->xvnc_pid, 2000);

    if (ctx->evt_fd >= 0) close(ctx->evt_fd);
    if (ctx->listen_fd >= 0) close(ctx->listen_fd);

    nexterm_ssh_full_cleanup(ctx->ssh, NULL, ctx->ssh_sock, &ctx->jump_chain,
                             "Web session ended");

    release_vnc_port(ctx->vnc_port);

    if (ctx->base_dir[0]) remove_tree(ctx->base_dir);

    free(ctx->last_favicon);
    pthread_mutex_destroy(&ctx->cmd_mutex);
    pthread_mutex_destroy(&ctx->state_mutex);
    free(ctx);
}

int nexterm_web_prepare(nexterm_session_t* session,
                        struct nexterm_control_plane* cp,
                        uint16_t* out_vnc_port) {
    web_ctx_t* ctx = calloc(1, sizeof(web_ctx_t));
    if (!ctx) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Out of memory", NULL);
        return -1;
    }

    ctx->cp = cp;
    ctx->ssh_sock = -1;
    ctx->listen_fd = -1;
    ctx->cmd_fd = -1;
    ctx->evt_fd = -1;
    ctx->webview_pid = -1;
    ctx->xvnc_pid = -1;
    pthread_mutex_init(&ctx->cmd_mutex, NULL);
    pthread_mutex_init(&ctx->state_mutex, NULL);
    snprintf(ctx->session_id, sizeof(ctx->session_id), "%s", session->session_id);

    for (int i = 0; i < WEB_MAX_PROXY_CONNS; i++) ctx->conns[i].fd = -1;

    const char* username = nexterm_session_get_param(session, "username");
    const char* password = nexterm_session_get_param(session, "password");
    const char* private_key = nexterm_session_get_param(session, "privateKey");
    const char* passphrase = nexterm_session_get_param(session, "passphrase");

    if (!username) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Missing SSH username", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count = nexterm_extract_jump_hosts(session, jump_hosts, MAX_JUMP_HOSTS);

    if (nexterm_ssh_setup_with_jumphosts(session->host, session->port,
                                         jump_hosts, jump_count,
                                         &ctx->ssh_sock, &ctx->ssh,
                                         &ctx->jump_chain) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to SSH server", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    if (nexterm_ssh_auth(ctx->ssh, username, password, private_key, passphrase) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "SSH authentication failed", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    libssh2_session_set_blocking(ctx->ssh, 0);

    ctx->listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (ctx->listen_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to create proxy socket", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;

    socklen_t addr_len = sizeof(addr);
    if (bind(ctx->listen_fd, (struct sockaddr*)&addr, sizeof(addr)) != 0 ||
        listen(ctx->listen_fd, 32) != 0 ||
        getsockname(ctx->listen_fd, (struct sockaddr*)&addr, &addr_len) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to bind egress proxy", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    ctx->proxy_port = ntohs(addr.sin_port);
    set_nonblocking(ctx->listen_fd);

    ctx->vnc_port = reserve_vnc_port();
    if (ctx->vnc_port == 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "No free display port for the browser", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    ctx->display_number = (uint16_t)(ctx->vnc_port - 5900);

    mkdir("/tmp/.X11-unix", 01777);

    const char* engine_path = getenv("PATH");
    snprintf(ctx->child_path, sizeof(ctx->child_path), "%s",
             (engine_path && *engine_path) ? engine_path : "/usr/local/bin:/usr/bin:/bin");

    snprintf(ctx->runtime_dir, sizeof(ctx->runtime_dir),
             WEB_SESSION_ROOT "/%s/run", session->session_id);
    snprintf(ctx->profile_dir, sizeof(ctx->profile_dir),
             WEB_SESSION_ROOT "/%s/profile", session->session_id);
    snprintf(ctx->config_dir, sizeof(ctx->config_dir),
             WEB_SESSION_ROOT "/%s/config", session->session_id);

    snprintf(ctx->base_dir, sizeof(ctx->base_dir), WEB_SESSION_ROOT "/%s", session->session_id);

    pthread_once(&g_sweep_once, sweep_stale_sessions);

    mkdir(WEB_SESSION_ROOT, 0700);
    if (mkdir(ctx->base_dir, 0700) != 0 && errno != EEXIST) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to create session directory", NULL);
        web_ctx_free(ctx);
        return -1;
    }
    mkdir(ctx->runtime_dir, 0700);
    mkdir(ctx->profile_dir, 0700);
    mkdir(ctx->config_dir, 0700);

    int cmd_pipe[2];
    int evt_pipe[2];
    if (pipe(cmd_pipe) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to create command pipe", NULL);
        web_ctx_free(ctx);
        return -1;
    }
    if (pipe(evt_pipe) != 0) {
        close(cmd_pipe[0]);
        close(cmd_pipe[1]);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to create event pipe", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    if (build_proxy_credential(ctx) != 0) {
        close(cmd_pipe[0]); close(cmd_pipe[1]);
        close(evt_pipe[0]); close(evt_pipe[1]);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to generate proxy credential", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    char proxy_arg[64];
    snprintf(proxy_arg, sizeof(proxy_arg), "http://127.0.0.1:%u", ctx->proxy_port);

    char* envp[32];
    if (build_browser_env(ctx, envp, 32) != 0) {
        close(cmd_pipe[0]); close(cmd_pipe[1]);
        close(evt_pipe[0]); close(evt_pipe[1]);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Out of memory", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    const char* xvnc_bin = binary_path("NEXTERM_XVNC_BIN", "Xvnc");
    const char* webview_bin = binary_path("NEXTERM_WEBVIEW_BIN", "nexterm-webview");

    char webview_sibling[512];
    if (!binary_available(webview_bin) &&
        sibling_binary("nexterm-webview", webview_sibling, sizeof(webview_sibling)))
        webview_bin = webview_sibling;

    if (!binary_available(xvnc_bin) || !binary_available(webview_bin)) {
        const char* missing = binary_available(xvnc_bin) ? webview_bin : xvnc_bin;
        LOG_ERROR("Web session %s: %s was not found in PATH", session->session_id, missing);
        env_free(envp);
        close(cmd_pipe[0]); close(cmd_pipe[1]);
        close(evt_pipe[0]); close(evt_pipe[1]);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       strcmp(missing, xvnc_bin) == 0
                                           ? "Xvnc is not installed on the engine host"
                                           : "nexterm-webview is not installed on the engine host",
                                       NULL);
        web_ctx_free(ctx);
        return -1;
    }

    char display_arg[16];
    snprintf(display_arg, sizeof(display_arg), ":%u", ctx->display_number);

    char rfbport_arg[16];
    snprintf(rfbport_arg, sizeof(rfbport_arg), "%u", ctx->vnc_port);

    const char* xvnc_argv[] = {
        xvnc_bin, display_arg,
        "-geometry", WEB_DEFAULT_GEOMETRY,
        "-depth", "24",
        "-rfbport", rfbport_arg,
        "-localhost",
        "-SecurityTypes", "None",
        "-AlwaysShared",
        "-desktop", "Nexterm",
        NULL
    };

    ctx->xvnc_pid = spawn_child(xvnc_argv, envp, -1, -1);

    if (ctx->xvnc_pid < 0 || wait_for_port(ctx->vnc_port, WEB_BROWSER_START_TIMEOUT_MS) != 0) {
        close(cmd_pipe[0]); close(cmd_pipe[1]);
        close(evt_pipe[0]); close(evt_pipe[1]);
        env_free(envp);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "The browser display server did not start", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    const char* webview_argv[] = {
        webview_bin,
        "--proxy", proxy_arg,
        "--proxy-user", WEB_PROXY_USERNAME,
        "--proxy-password", ctx->proxy_password,
        "--profile", ctx->profile_dir,
        NULL
    };

    ctx->webview_pid = spawn_child(webview_argv, envp, cmd_pipe[0], evt_pipe[1]);

    close(cmd_pipe[0]);
    close(evt_pipe[1]);
    ctx->cmd_fd = cmd_pipe[1];
    ctx->evt_fd = evt_pipe[0];

    env_free(envp);

    if (ctx->webview_pid < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to start the browser", NULL);
        web_ctx_free(ctx);
        return -1;
    }

    if (pthread_create(&ctx->proxy_thread, NULL, proxy_thread_main, ctx) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to start the egress proxy", NULL);
        web_ctx_free(ctx);
        return -1;
    }
    ctx->proxy_thread_active = true;

    if (pthread_create(&ctx->event_thread, NULL, event_thread_main, ctx) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to start the browser event reader", NULL);
        web_ctx_free(ctx);
        return -1;
    }
    ctx->event_thread_active = true;

    web_ctx_register(ctx);
    session->web_ctx = ctx;
    *out_vnc_port = ctx->vnc_port;

    LOG_INFO("Web session %s ready (ssh=%s:%d, proxy=127.0.0.1:%u, vnc=127.0.0.1:%u)",
             session->session_id, session->host, session->port,
             ctx->proxy_port, ctx->vnc_port);
    return 0;
}

void nexterm_web_attach_client(nexterm_session_t* session, guac_client* client) {
    web_ctx_t* ctx = session->web_ctx;
    if (!ctx) return;

    ctx->guac_client = client;
    ctx->prev_join_pending = client->join_pending_handler;
    client->join_pending_handler = web_join_pending_handler;
}

void nexterm_web_teardown(nexterm_session_t* session) {
    web_ctx_t* ctx = session->web_ctx;
    if (!ctx) return;

    session->web_ctx = NULL;
    LOG_INFO("Web session %s tearing down browser stack", ctx->session_id);
    web_ctx_free(ctx);
}

static int web_write_command(web_ctx_t* ctx, const char* command) {
    if (!ctx || !command) return -1;

    if (strpbrk(command, "\r\n") != NULL) {
        LOG_WARN("Web session %s: rejected a command containing a newline", ctx->session_id);
        return -1;
    }

    size_t len = strlen(command);
    char line[4096];
    if (len + 2 > sizeof(line)) return -1;

    memcpy(line, command, len);
    line[len] = '\n';

    int result = 0;
    pthread_mutex_lock(&ctx->cmd_mutex);
    if (ctx->cmd_fd < 0 || nexterm_write_exact(ctx->cmd_fd, (const uint8_t*)line, len + 1) != 0)
        result = -1;
    pthread_mutex_unlock(&ctx->cmd_mutex);

    return result;
}
