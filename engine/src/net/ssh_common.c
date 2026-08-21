#include "ssh_common.h"

#include <stdio.h>

#include "io.h"
#include "log.h"

#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <poll.h>
#include <errno.h>
#include <stdlib.h>

int nexterm_ssh_setup(const char* host, uint16_t port,
                      int* out_sock, LIBSSH2_SESSION** out_session) {
    int sock = nexterm_tcp_connect(host, port);
    if (sock < 0) return -1;

    LIBSSH2_SESSION* session = libssh2_session_init();
    if (!session) {
        close(sock);
        return -1;
    }

    libssh2_session_set_timeout(session, 30000);

    if (libssh2_session_handshake(session, sock) != 0) {
        char* errmsg = NULL;
        libssh2_session_last_error(session, &errmsg, NULL, 0);
        LOG_ERROR("SSH handshake failed: %s", errmsg ? errmsg : "unknown");
        libssh2_session_free(session);
        close(sock);
        return -1;
    }

    *out_sock = sock;
    *out_session = session;
    return 0;
}

typedef struct {
    LIBSSH2_SESSION* parent_session;
    LIBSSH2_CHANNEL* channel;
    int sockfd;
    int parent_sock;
    volatile int* stop;
} channel_proxy_ctx_t;

static void bridge_channel_socket(LIBSSH2_SESSION* parent_session,
                                  LIBSSH2_CHANNEL* channel,
                                  int sockfd, int parent_sock,
                                  volatile int* stop) {
    char buf[16384];
    int was_blocking = libssh2_session_get_blocking(parent_session);
    libssh2_session_set_blocking(parent_session, 0);

    while (!*stop) {
        for (;;) {
            ssize_t n = libssh2_channel_read(channel, buf, sizeof(buf));
            if (n > 0) {
                ssize_t off = 0;
                while (off < n) {
                    ssize_t w = write(sockfd, buf + off, (size_t)(n - off));
                    if (w <= 0) goto done;
                    off += w;
                }
                continue;
            }
            if (n == 0) {
                if (libssh2_channel_eof(channel)) goto done;
                break;
            }
            if (n == LIBSSH2_ERROR_EAGAIN) break;
            goto done;
        }

        struct pollfd fds[2] = {
            { .fd = sockfd,      .events = POLLIN, .revents = 0 },
            { .fd = parent_sock, .events = POLLIN, .revents = 0 },
        };
        int ret = poll(fds, 2, 200);
        if (ret < 0) {
            if (errno == EINTR) continue;
            goto done;
        }

        if (fds[0].revents & POLLIN) {
            ssize_t nr = read(sockfd, buf, sizeof(buf));
            if (nr <= 0) goto done;
            ssize_t off = 0;
            while (off < nr) {
                ssize_t w = libssh2_channel_write(channel, buf + off, (size_t)(nr - off));
                if (w == LIBSSH2_ERROR_EAGAIN) {
                    struct pollfd wp = { .fd = parent_sock, .events = POLLOUT, .revents = 0 };
                    poll(&wp, 1, 1000);
                    continue;
                }
                if (w < 0) goto done;
                off += w;
            }
        }

        if (fds[0].revents & (POLLHUP | POLLERR)) goto done;
        if (fds[1].revents & (POLLHUP | POLLERR)) {
            for (;;) {
                ssize_t n = libssh2_channel_read(channel, buf, sizeof(buf));
                if (n <= 0) break;
                ssize_t off = 0;
                while (off < n) {
                    ssize_t w = write(sockfd, buf + off, (size_t)(n - off));
                    if (w <= 0) goto done;
                    off += w;
                }
            }
            goto done;
        }
    }

done:
    libssh2_session_set_blocking(parent_session, was_blocking);
    close(sockfd);
}

static void* channel_proxy_thread(void* arg) {
    channel_proxy_ctx_t* ctx = (channel_proxy_ctx_t*)arg;
    LIBSSH2_SESSION* parent_session = ctx->parent_session;
    LIBSSH2_CHANNEL* channel = ctx->channel;
    int sockfd = ctx->sockfd;
    int parent_sock = ctx->parent_sock;
    volatile int* stop = ctx->stop;
    free(ctx);

    bridge_channel_socket(parent_session, channel, sockfd, parent_sock, stop);
    return NULL;
}

static int ssh_setup_on_channel(jump_chain_t* chain,
                                LIBSSH2_SESSION* parent_session,
                                int parent_sock,
                                LIBSSH2_CHANNEL* channel,
                                LIBSSH2_SESSION** out_session,
                                int* out_proxy_sock) {
    int sv[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, sv) != 0) {
        LOG_ERROR("socketpair failed for jump host tunnel");
        return -1;
    }

    channel_proxy_ctx_t* ctx = malloc(sizeof(channel_proxy_ctx_t));
    if (!ctx) {
        close(sv[0]);
        close(sv[1]);
        return -1;
    }
    ctx->parent_session = parent_session;
    ctx->channel = channel;
    ctx->sockfd = sv[1];
    ctx->parent_sock = parent_sock;
    ctx->stop = &chain->stop_proxies;

    pthread_t tid;
    if (pthread_create(&tid, NULL, channel_proxy_thread, ctx) != 0) {
        LOG_ERROR("Failed to create channel proxy thread");
        free(ctx);
        close(sv[0]);
        close(sv[1]);
        return -1;
    }
    chain->proxies[chain->proxy_count++] = tid;

    LIBSSH2_SESSION* session = libssh2_session_init();
    if (!session) {
        close(sv[0]);
        return -1;
    }

    libssh2_session_set_timeout(session, 30000);

    if (libssh2_session_handshake(session, sv[0]) != 0) {
        char* errmsg = NULL;
        libssh2_session_last_error(session, &errmsg, NULL, 0);
        LOG_ERROR("SSH handshake over tunnel failed: %s", errmsg ? errmsg : "unknown");
        libssh2_session_free(session);
        close(sv[0]);
        return -1;
    }

    *out_session = session;
    *out_proxy_sock = sv[0];
    return 0;
}

static int build_jump_chain(const jump_host_t* jump_hosts, int jump_count,
                            jump_chain_t* chain) {
    const jump_host_t* jh = &jump_hosts[0];
    LOG_INFO("Jump host chain: connecting to hop 1 (%s:%u)", jh->host, jh->port);

    if (nexterm_ssh_setup(jh->host, jh->port,
                          &chain->sockets[0], &chain->sessions[0]) != 0) {
        LOG_ERROR("Failed to connect to jump host 1 (%s:%u)", jh->host, jh->port);
        return -1;
    }

    if (nexterm_ssh_auth(chain->sessions[0], jh->username,
                         jh->password, jh->private_key, jh->passphrase) != 0) {
        LOG_ERROR("Failed to authenticate to jump host 1 (%s:%u)", jh->host, jh->port);
        nexterm_jump_chain_teardown(chain);
        return -1;
    }
    chain->count = 1;

    for (int i = 1; i < jump_count; i++) {
        const jump_host_t* next_jh = &jump_hosts[i];
        LOG_INFO("Jump host chain: forwarding to hop %d (%s:%u)", i + 1, next_jh->host, next_jh->port);

        LIBSSH2_CHANNEL* fwd = libssh2_channel_direct_tcpip(
            chain->sessions[i - 1], next_jh->host, next_jh->port);
        if (!fwd) {
            char* errmsg = NULL;
            libssh2_session_last_error(chain->sessions[i - 1], &errmsg, NULL, 0);
            LOG_ERROR("Failed to forward to jump host %d (%s:%u): %s",
                      i + 1, next_jh->host, next_jh->port, errmsg ? errmsg : "unknown");
            nexterm_jump_chain_teardown(chain);
            return -1;
        }
        chain->channels[i - 1] = fwd;

        int proxy_sock = -1;
        if (ssh_setup_on_channel(chain, chain->sessions[i - 1], chain->sockets[i - 1], fwd,
                                 &chain->sessions[i], &proxy_sock) != 0) {
            LOG_ERROR("Failed SSH handshake over tunnel to jump host %d", i + 1);
            nexterm_jump_chain_teardown(chain);
            return -1;
        }
        chain->sockets[i] = proxy_sock;

        if (nexterm_ssh_auth(chain->sessions[i], next_jh->username,
                             next_jh->password, next_jh->private_key, next_jh->passphrase) != 0) {
            LOG_ERROR("Failed to authenticate to jump host %d (%s:%u)", i + 1, next_jh->host, next_jh->port);
            nexterm_jump_chain_teardown(chain);
            return -1;
        }
        chain->count = i + 1;
    }

    return 0;
}

int nexterm_ssh_setup_with_jumphosts(const char* target_host, uint16_t target_port,
                                     const jump_host_t* jump_hosts, int jump_count,
                                     int* out_sock, LIBSSH2_SESSION** out_session,
                                     jump_chain_t* chain) {
    memset(chain, 0, sizeof(jump_chain_t));
    for (int i = 0; i < MAX_JUMP_HOSTS; i++)
        chain->sockets[i] = -1;

    if (jump_count <= 0 || jump_count > MAX_JUMP_HOSTS)
        return nexterm_ssh_setup(target_host, target_port, out_sock, out_session);

    if (build_jump_chain(jump_hosts, jump_count, chain) != 0)
        return -1;

    LOG_INFO("Jump host chain: forwarding to target %s:%u", target_host, target_port);
    LIBSSH2_CHANNEL* target_fwd = libssh2_channel_direct_tcpip(
        chain->sessions[jump_count - 1], target_host, target_port);
    if (!target_fwd) {
        char* errmsg = NULL;
        libssh2_session_last_error(chain->sessions[jump_count - 1], &errmsg, NULL, 0);
        LOG_ERROR("Failed to forward to target %s:%u: %s",
                  target_host, target_port, errmsg ? errmsg : "unknown");
        nexterm_jump_chain_teardown(chain);
        return -1;
    }
    chain->channels[jump_count - 1] = target_fwd;

    int target_proxy_sock = -1;
    if (ssh_setup_on_channel(chain, chain->sessions[jump_count - 1], chain->sockets[jump_count - 1], target_fwd,
                             out_session, &target_proxy_sock) != 0) {
        LOG_ERROR("Failed SSH handshake to target over jump host chain");
        nexterm_jump_chain_teardown(chain);
        return -1;
    }

    *out_sock = target_proxy_sock;
    return 0;
}

int nexterm_ssh_auth(LIBSSH2_SESSION* session, const char* username,
                     const char* password, const char* private_key,
                     const char* passphrase) {
    if (private_key && private_key[0] != '\0') {
        const char* pp = (passphrase && passphrase[0] != '\0') ? passphrase : NULL;
        if (libssh2_userauth_publickey_frommemory(
                session, username, strlen(username),
                NULL, 0, private_key, strlen(private_key), pp) == 0)
            return 0;
    }

    if (password && password[0] != '\0'
            && libssh2_userauth_password(session, username, password) == 0)
        return 0;

    return -1;
}

void nexterm_ssh_teardown(LIBSSH2_SESSION* session, LIBSSH2_CHANNEL* channel,
                          int sock, const char* reason) {
    if (channel) {
        libssh2_channel_send_eof(channel);
        libssh2_channel_close(channel);
        libssh2_channel_wait_closed(channel);
        libssh2_channel_free(channel);
    }
    if (session) {
        libssh2_session_disconnect(session, reason);
        libssh2_session_free(session);
    }
    if (sock >= 0) close(sock);
}

void nexterm_jump_chain_teardown(jump_chain_t* chain) {
    if (!chain) return;

    chain->stop_proxies = 1;

    for (int i = chain->count - 1; i >= 0; i--) {
        if (chain->sockets[i] >= 0) {
            close(chain->sockets[i]);
            chain->sockets[i] = -1;
        }
    }

    for (int i = 0; i < chain->proxy_count; i++)
        pthread_join(chain->proxies[i], NULL);
    chain->proxy_count = 0;

    for (int i = chain->count - 1; i >= 0; i--) {
        if (chain->channels[i]) {
            libssh2_channel_free(chain->channels[i]);
            chain->channels[i] = NULL;
        }
        if (chain->sessions[i]) {
            libssh2_session_disconnect(chain->sessions[i], "Jump chain teardown");
            libssh2_session_free(chain->sessions[i]);
            chain->sessions[i] = NULL;
        }
    }
    chain->count = 0;
}

static void* jump_tunnel_thread(void* arg) {
    jump_tunnel_t* tunnel = (jump_tunnel_t*)arg;
    LIBSSH2_SESSION* last_session = tunnel->chain.sessions[tunnel->chain.count - 1];
    int parent_sock = tunnel->chain.sockets[tunnel->chain.count - 1];

    while (!tunnel->stop) {
        struct pollfd pfd = { .fd = tunnel->listen_fd, .events = POLLIN, .revents = 0 };
        int ret = poll(&pfd, 1, 500);
        if (ret < 0) {
            if (errno == EINTR) continue;
            break;
        }
        if (ret == 0) continue;
        if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) break;

        int client_fd = accept(tunnel->listen_fd, NULL, NULL);
        if (client_fd < 0) {
            if (errno == EINTR) continue;
            break;
        }

        LIBSSH2_CHANNEL* channel = tunnel->pending_channel;
        tunnel->pending_channel = NULL;
        if (!channel)
            channel = libssh2_channel_direct_tcpip(last_session,
                                                   tunnel->target_host,
                                                   tunnel->target_port);
        if (!channel) {
            char* errmsg = NULL;
            libssh2_session_last_error(last_session, &errmsg, NULL, 0);
            LOG_ERROR("Jump tunnel: forward to %s:%u failed: %s",
                      tunnel->target_host, tunnel->target_port,
                      errmsg ? errmsg : "unknown");
            close(client_fd);
            continue;
        }

        bridge_channel_socket(last_session, channel, client_fd, parent_sock,
                              &tunnel->stop);

        libssh2_channel_close(channel);
        libssh2_channel_free(channel);
    }

    return NULL;
}

int nexterm_jump_tunnel_start(jump_tunnel_t* tunnel,
                              const char* target_host, uint16_t target_port,
                              const jump_host_t* jump_hosts, int jump_count) {
    memset(tunnel, 0, sizeof(jump_tunnel_t));
    tunnel->listen_fd = -1;
    for (int i = 0; i < MAX_JUMP_HOSTS; i++)
        tunnel->chain.sockets[i] = -1;

    if (jump_count <= 0 || jump_count > MAX_JUMP_HOSTS) {
        LOG_ERROR("Jump tunnel: invalid jump host count %d", jump_count);
        return -1;
    }

    snprintf(tunnel->target_host, sizeof(tunnel->target_host), "%s", target_host);
    tunnel->target_port = target_port;

    if (build_jump_chain(jump_hosts, jump_count, &tunnel->chain) != 0)
        return -1;

    tunnel->pending_channel = libssh2_channel_direct_tcpip(
        tunnel->chain.sessions[jump_count - 1], tunnel->target_host, tunnel->target_port);
    if (!tunnel->pending_channel) {
        char* errmsg = NULL;
        libssh2_session_last_error(tunnel->chain.sessions[jump_count - 1], &errmsg, NULL, 0);
        LOG_ERROR("Jump tunnel: forward to target %s:%u failed: %s",
                  tunnel->target_host, tunnel->target_port, errmsg ? errmsg : "unknown");
        nexterm_jump_chain_teardown(&tunnel->chain);
        return -1;
    }

    tunnel->listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (tunnel->listen_fd < 0) {
        LOG_ERROR("Jump tunnel: failed to create listener socket: %s", strerror(errno));
        goto fail;
    }

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;

    if (bind(tunnel->listen_fd, (struct sockaddr*)&addr, sizeof(addr)) != 0 ||
        listen(tunnel->listen_fd, 4) != 0) {
        LOG_ERROR("Jump tunnel: failed to bind loopback listener: %s", strerror(errno));
        goto fail;
    }

    socklen_t addr_len = sizeof(addr);
    if (getsockname(tunnel->listen_fd, (struct sockaddr*)&addr, &addr_len) != 0) {
        LOG_ERROR("Jump tunnel: getsockname failed: %s", strerror(errno));
        goto fail;
    }
    tunnel->local_port = ntohs(addr.sin_port);

    if (pthread_create(&tunnel->thread, NULL, jump_tunnel_thread, tunnel) != 0) {
        LOG_ERROR("Jump tunnel: failed to create tunnel thread");
        goto fail;
    }
    tunnel->thread_started = 1;

    LOG_INFO("Jump tunnel: 127.0.0.1:%u -> %s:%u via %d jump host(s)",
             tunnel->local_port, tunnel->target_host, tunnel->target_port, jump_count);
    return 0;

fail:
    if (tunnel->listen_fd >= 0) {
        close(tunnel->listen_fd);
        tunnel->listen_fd = -1;
    }
    if (tunnel->pending_channel) {
        libssh2_channel_free(tunnel->pending_channel);
        tunnel->pending_channel = NULL;
    }
    nexterm_jump_chain_teardown(&tunnel->chain);
    return -1;
}

void nexterm_jump_tunnel_stop(jump_tunnel_t* tunnel) {
    if (!tunnel) return;
    tunnel->stop = 1;

    if (tunnel->thread_started) {
        pthread_join(tunnel->thread, NULL);
        tunnel->thread_started = 0;
    }

    if (tunnel->listen_fd >= 0) {
        close(tunnel->listen_fd);
        tunnel->listen_fd = -1;
    }

    if (tunnel->pending_channel) {
        libssh2_channel_close(tunnel->pending_channel);
        libssh2_channel_free(tunnel->pending_channel);
        tunnel->pending_channel = NULL;
    }

    nexterm_jump_chain_teardown(&tunnel->chain);
}

void nexterm_ssh_full_cleanup(LIBSSH2_SESSION* session, LIBSSH2_CHANNEL* channel,
                              int sock, jump_chain_t* chain, const char* reason) {
    nexterm_ssh_teardown(session, channel,
                         (chain && chain->count > 0) ? -1 : sock, reason);
    if (chain && chain->count > 0) {
        nexterm_jump_chain_teardown(chain);
        if (sock >= 0) close(sock);
    }
}

void nexterm_ssh_read_stream(LIBSSH2_CHANNEL* channel, char* buf,
                             size_t buf_sz, int use_stderr) {
    char tmp[4096];
    size_t len = 0;

    while (len < buf_sz - 1) {
        ssize_t n = use_stderr
            ? libssh2_channel_read_stderr(channel, tmp, sizeof(tmp))
            : libssh2_channel_read(channel, tmp, sizeof(tmp));
        if (n <= 0) break;
        size_t remaining = buf_sz - 1 - len;
        size_t copy = ((size_t)n <= remaining) ? (size_t)n : remaining;
        memcpy(buf + len, tmp, copy);
        len += copy;
    }
    buf[len] = '\0';
}
