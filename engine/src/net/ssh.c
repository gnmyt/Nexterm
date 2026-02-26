#include "ssh.h"
#include "ssh_common.h"
#include "control_plane.h"
#include "io.h"
#include "log.h"

#include <libssh2.h>

#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define SSH_READ_BUF_SIZE  16384
#define SSH_EXEC_BUF_SIZE  (256 * 1024)

int nexterm_extract_jump_hosts(const nexterm_session_t* session,
                               jump_host_t* jump_hosts,
                               int max_jump_hosts) {
    const char* count_str = nexterm_session_get_param(session, "jumpHostCount");
    if (!count_str) return 0;
    int count = atoi(count_str);
    if (count <= 0) return 0;
    if (count > max_jump_hosts) count = max_jump_hosts;

    for (int i = 0; i < count; i++) {
        char key[64];
        memset(&jump_hosts[i], 0, sizeof(jump_host_t));

        snprintf(key, sizeof(key), "jumpHost%d_host", i);
        const char* host = nexterm_session_get_param(session, key);
        if (!host || host[0] == '\0') return i;
        snprintf(jump_hosts[i].host, sizeof(jump_hosts[i].host), "%s", host);

        snprintf(key, sizeof(key), "jumpHost%d_port", i);
        const char* port_str = nexterm_session_get_param(session, key);
        jump_hosts[i].port = port_str ? (uint16_t)atoi(port_str) : 22;

        snprintf(key, sizeof(key), "jumpHost%d_username", i);
        const char* username = nexterm_session_get_param(session, key);
        if (username) snprintf(jump_hosts[i].username, sizeof(jump_hosts[i].username), "%s", username);

        snprintf(key, sizeof(key), "jumpHost%d_password", i);
        jump_hosts[i].password = (char*)nexterm_session_get_param(session, key);

        snprintf(key, sizeof(key), "jumpHost%d_privateKey", i);
        jump_hosts[i].private_key = (char*)nexterm_session_get_param(session, key);

        snprintf(key, sizeof(key), "jumpHost%d_passphrase", i);
        jump_hosts[i].passphrase = (char*)nexterm_session_get_param(session, key);
    }
    return count;
}

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} ssh_thread_args_t;

static void nanosleep_ms(unsigned int ms) {
    struct timespec ts = {
        .tv_sec = ms / 1000,
        .tv_nsec = (ms % 1000) * 1000000L
    };
    nanosleep(&ts, NULL);
}

static int ssh_write_to_channel(LIBSSH2_CHANNEL* channel,
                                const char* buf, size_t len) {
    size_t written = 0;
    while (written < len) {
        ssize_t w = libssh2_channel_write(channel, buf + written, len - written);
        if (w == LIBSSH2_ERROR_EAGAIN) {
            nanosleep_ms(1);
            continue;
        }
        if (w < 0) return -1;
        written += (size_t)w;
    }
    return 0;
}

static int ssh_read_channel_to_fd(LIBSSH2_CHANNEL* channel, int fd) {
    char buf[SSH_READ_BUF_SIZE];
    for (;;) {
        ssize_t n = libssh2_channel_read(channel, buf, sizeof(buf));
        if (n == LIBSSH2_ERROR_EAGAIN) return 0;
        if (n < 0) return -1;
        if (n == 0) return 0;
        if (nexterm_write_exact(fd, (const uint8_t*)buf, (size_t)n) != 0) return -1;
    }
}

static void ssh_drain_channel(LIBSSH2_CHANNEL* channel, int fd) {
    char buf[SSH_READ_BUF_SIZE];
    for (;;) {
        ssize_t n = libssh2_channel_read(channel, buf, sizeof(buf));
        if (n <= 0) break;
        nexterm_write_exact(fd, (const uint8_t*)buf, (size_t)n);
    }
}

static bool ssh_bridge_poll(int data_fd, int ssh_sock,
                           LIBSSH2_CHANNEL* channel) {
    char buf[SSH_READ_BUF_SIZE];
    struct pollfd fds[2] = {
        { .fd = data_fd,  .events = POLLIN },
        { .fd = ssh_sock, .events = POLLIN },
    };

    int ret = poll(fds, 2, 200);
    if (ret < 0)
        return errno == EINTR;
    if (ret == 0)
        return true;

    if (fds[0].revents & POLLIN) {
        ssize_t n = read(data_fd, buf, sizeof(buf));
        if (n <= 0) return false;
        if (ssh_write_to_channel(channel, buf, (size_t)n) != 0) return false;
    }

    if ((fds[1].revents & POLLIN)
            && ssh_read_channel_to_fd(channel, data_fd) != 0)
        return false;

    if (fds[0].revents & (POLLERR | POLLHUP))
        return false;

    if (libssh2_channel_eof(channel)) {
        ssh_drain_channel(channel, data_fd);
        return false;
    }

    if (fds[1].revents & (POLLERR | POLLHUP)) {
        ssh_drain_channel(channel, data_fd);
        return false;
    }

    return true;
}

static void ssh_bridge_data(const nexterm_session_t* session, int data_fd,
                            LIBSSH2_CHANNEL* channel, int ssh_sock) {
    while (session->state == SESSION_STATE_ACTIVE
            && ssh_bridge_poll(data_fd, ssh_sock, channel));
}

static void* ssh_session_thread(void* arg) {
    ssh_thread_args_t* args = (ssh_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    int ssh_sock = -1;
    LIBSSH2_SESSION* ssh_session = NULL;
    LIBSSH2_CHANNEL* channel = NULL;
    jump_chain_t jump_chain = {0};

    session->state = SESSION_STATE_CONNECTING;

    const char* username = nexterm_session_get_param(session, "username");
    const char* password = nexterm_session_get_param(session, "password");
    const char* private_key = nexterm_session_get_param(session, "privateKey");
    const char* passphrase = nexterm_session_get_param(session, "passphrase");

    if (!username || username[0] == '\0') {
        LOG_ERROR("SSH session %s: missing username", session->session_id);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Missing username", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count = nexterm_extract_jump_hosts(session, jump_hosts, MAX_JUMP_HOSTS);

    LOG_INFO("SSH session %s: connecting to %s:%u as %s (jump_hosts=%d)",
             session->session_id, session->host, session->port, username, jump_count);

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    if (nexterm_ssh_setup_with_jumphosts(session->host, session->port,
            jump_hosts, jump_count, &ssh_sock, &ssh_session, &jump_chain) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to SSH host", NULL);
        goto cleanup;
    }

    if (nexterm_ssh_auth(ssh_session, username, password, private_key, passphrase) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "SSH authentication failed", NULL);
        goto cleanup;
    }

    LOG_DEBUG("SSH session %s: authenticated", session->session_id);

    channel = libssh2_channel_open_session(ssh_session);
    if (!channel) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open SSH channel", NULL);
        goto cleanup;
    }

    if (libssh2_channel_request_pty(channel, "xterm-256color") != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to request PTY", NULL);
        goto cleanup;
    }

    if (libssh2_channel_shell(channel) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to start shell", NULL);
        goto cleanup;
    }

    libssh2_session_set_blocking(ssh_session, 0);

    session->ssh_session = ssh_session;
    session->ssh_channel = channel;
    session->ssh_sock = ssh_sock;
    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    LOG_INFO("SSH session %s active (target=%s:%d, user=%s)",
             session->session_id, session->host, session->port, username);

    ssh_bridge_data(session, data_fd, channel, ssh_sock);

    LOG_INFO("SSH session %s ending", session->session_id);

cleanup:
    session->ssh_session = NULL;
    session->ssh_channel = NULL;
    session->ssh_sock = -1;

    nexterm_ssh_full_cleanup(ssh_session, channel, ssh_sock, &jump_chain, "Session ended");

    if (data_fd >= 0)
        close(data_fd);

    session->state = SESSION_STATE_CLOSED;
    nexterm_cp_send_session_closed(cp, session->session_id, "session ended");

    free(args);
    return NULL;
}

int nexterm_ssh_start(nexterm_session_t* session,
                      nexterm_control_plane_t* cp) {
    ssh_thread_args_t* args = calloc(1, sizeof(ssh_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, ssh_session_thread, args) != 0) {
        LOG_ERROR("Failed to create SSH thread for session %s", session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}

void nexterm_ssh_resize(nexterm_session_t* session,
                        uint16_t cols, uint16_t rows) {
    LIBSSH2_CHANNEL* channel = (LIBSSH2_CHANNEL*)session->ssh_channel;
    if (!channel || session->state != SESSION_STATE_ACTIVE) return;

    int rc = libssh2_channel_request_pty_size(channel, cols, rows);
    if (rc && rc != LIBSSH2_ERROR_EAGAIN)
        LOG_WARN("SSH session %s: PTY resize failed (rc=%d)", session->session_id, rc);
    else
        LOG_DEBUG("SSH session %s: resized to %ux%u", session->session_id, cols, rows);
}

static void* tunnel_session_thread(void* arg) {
    ssh_thread_args_t* args = (ssh_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    int ssh_sock = -1;
    LIBSSH2_SESSION* ssh_session = NULL;
    LIBSSH2_CHANNEL* channel = NULL;
    jump_chain_t jump_chain = {0};

    session->state = SESSION_STATE_CONNECTING;

    const char* username = nexterm_session_get_param(session, "username");
    const char* password = nexterm_session_get_param(session, "password");
    const char* private_key = nexterm_session_get_param(session, "privateKey");
    const char* passphrase = nexterm_session_get_param(session, "passphrase");
    const char* remote_host = nexterm_session_get_param(session, "remoteHost");
    const char* remote_port_str = nexterm_session_get_param(session, "remotePort");

    if (!username || username[0] == '\0') {
        nexterm_cp_send_session_result(cp, session->session_id, false, "Missing username", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }
    if (!remote_host || !remote_port_str) {
        nexterm_cp_send_session_result(cp, session->session_id, false, "Missing remoteHost/remotePort", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    char* endptr;
    long remote_port = strtol(remote_port_str, &endptr, 10);
    if (*endptr != '\0' || remote_port <= 0 || remote_port > 65535) {
        nexterm_cp_send_session_result(cp, session->session_id, false, "Invalid remotePort", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count = nexterm_extract_jump_hosts(session, jump_hosts, MAX_JUMP_HOSTS);

    LOG_INFO("Tunnel session %s: %s:%u -> forward to %s:%ld (jump_hosts=%d)",
             session->session_id, session->host, session->port, remote_host, remote_port, jump_count);

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    if (nexterm_ssh_setup_with_jumphosts(session->host, session->port,
            jump_hosts, jump_count, &ssh_sock, &ssh_session, &jump_chain) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to SSH host", NULL);
        goto cleanup;
    }

    if (nexterm_ssh_auth(ssh_session, username, password, private_key, passphrase) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "SSH authentication failed", NULL);
        goto cleanup;
    }

    channel = libssh2_channel_direct_tcpip(ssh_session, remote_host, (int)remote_port);
    if (!channel) {
        char* errmsg = NULL;
        libssh2_session_last_error(ssh_session, &errmsg, NULL, 0);
        LOG_ERROR("Tunnel session %s: forwardOut failed: %s",
                  session->session_id, errmsg ? errmsg : "unknown");
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Port forward failed", NULL);
        goto cleanup;
    }

    libssh2_session_set_blocking(ssh_session, 0);

    session->ssh_session = ssh_session;
    session->ssh_channel = channel;
    session->ssh_sock = ssh_sock;
    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    LOG_INFO("Tunnel session %s active (%s:%u -> %s:%ld)",
             session->session_id, session->host, session->port, remote_host, remote_port);

    ssh_bridge_data(session, data_fd, channel, ssh_sock);

    LOG_INFO("Tunnel session %s ending", session->session_id);

cleanup:
    session->ssh_session = NULL;
    session->ssh_channel = NULL;
    session->ssh_sock = -1;

    nexterm_ssh_full_cleanup(ssh_session, channel, ssh_sock, &jump_chain, "Tunnel ended");

    if (data_fd >= 0)
        close(data_fd);

    session->state = SESSION_STATE_CLOSED;
    nexterm_cp_send_session_closed(cp, session->session_id, "tunnel ended");

    free(args);
    return NULL;
}

int nexterm_tunnel_start(nexterm_session_t* session,
                         nexterm_control_plane_t* cp) {
    ssh_thread_args_t* args = calloc(1, sizeof(ssh_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, tunnel_session_thread, args) != 0) {
        LOG_ERROR("Failed to create tunnel thread for session %s", session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}

typedef struct {
    nexterm_control_plane_t* cp;
    char request_id[128];
    char host[256];
    uint16_t port;
    char* username;
    char* password;
    char* private_key;
    char* passphrase;
    char* command;
    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count;
} exec_cmd_args_t;

static void exec_cmd_free(exec_cmd_args_t* args) {
    free(args->username);
    free(args->password);
    free(args->private_key);
    free(args->passphrase);
    free(args->command);
    for (int i = 0; i < args->jump_count; i++) {
        free(args->jump_hosts[i].password);
        free(args->jump_hosts[i].private_key);
        free(args->jump_hosts[i].passphrase);
    }
    free(args);
}

static void* exec_command_thread(void* arg) {
    exec_cmd_args_t* args = (exec_cmd_args_t*)arg;
    int ssh_sock = -1;
    LIBSSH2_SESSION* ssh = NULL;
    LIBSSH2_CHANNEL* channel = NULL;
    jump_chain_t jump_chain = {0};

    if (nexterm_ssh_setup_with_jumphosts(args->host, args->port,
            args->jump_hosts, args->jump_count, &ssh_sock, &ssh, &jump_chain) != 0) {
        nexterm_cp_send_exec_result(args->cp, args->request_id, false,
                                    NULL, NULL, -1, "Failed to connect to SSH host");
        exec_cmd_free(args);
        return NULL;
    }

    if (nexterm_ssh_auth(ssh, args->username, args->password,
                         args->private_key, args->passphrase) != 0) {
        nexterm_cp_send_exec_result(args->cp, args->request_id, false,
                                    NULL, NULL, -1, "SSH authentication failed");
        goto cleanup;
    }

    channel = libssh2_channel_open_session(ssh);
    if (!channel) {
        nexterm_cp_send_exec_result(args->cp, args->request_id, false,
                                    NULL, NULL, -1, "Failed to open SSH channel");
        goto cleanup;
    }

    if (libssh2_channel_exec(channel, args->command) != 0) {
        nexterm_cp_send_exec_result(args->cp, args->request_id, false,
                                    NULL, NULL, -1, "Failed to execute command");
        goto cleanup;
    }

    {
        char* stdout_buf = malloc(SSH_EXEC_BUF_SIZE);
        char* stderr_buf = malloc(SSH_EXEC_BUF_SIZE);
        if (!stdout_buf || !stderr_buf) {
            free(stdout_buf);
            free(stderr_buf);
            nexterm_cp_send_exec_result(args->cp, args->request_id, false,
                                        NULL, NULL, -1, "Out of memory");
            goto cleanup;
        }

        nexterm_ssh_read_stream(channel, stdout_buf, SSH_EXEC_BUF_SIZE, 0);
        nexterm_ssh_read_stream(channel, stderr_buf, SSH_EXEC_BUF_SIZE, 1);

        libssh2_channel_close(channel);
        libssh2_channel_wait_closed(channel);
        int exit_code = libssh2_channel_get_exit_status(channel);

        nexterm_cp_send_exec_result(args->cp, args->request_id, true,
                                    stdout_buf, stderr_buf, exit_code, NULL);

        free(stdout_buf);
        free(stderr_buf);
        channel = NULL;
    }

cleanup:
    nexterm_ssh_full_cleanup(ssh, channel, ssh_sock, &jump_chain, "Done");
    exec_cmd_free(args);
    return NULL;
}

int nexterm_ssh_exec_command(nexterm_control_plane_t* cp,
                             const char* request_id,
                             const char* host, uint16_t port,
                             const ssh_credentials_t* creds,
                             const char* command,
                             const jump_host_t* jump_hosts,
                             int jump_count) {
    exec_cmd_args_t* args = calloc(1, sizeof(exec_cmd_args_t));
    if (!args) return -1;

    args->cp = cp;
    snprintf(args->request_id, sizeof(args->request_id), "%s", request_id);
    snprintf(args->host, sizeof(args->host), "%s", host);
    args->port = port;
    args->username = strdup(creds->username ? creds->username : "");
    args->password = strdup(creds->password ? creds->password : "");
    args->private_key = strdup(creds->private_key ? creds->private_key : "");
    args->passphrase = strdup(creds->passphrase ? creds->passphrase : "");
    args->command = strdup(command ? command : "");

    if (!args->username || !args->password || !args->private_key ||
        !args->passphrase || !args->command) {
        exec_cmd_free(args);
        return -1;
    }

    args->jump_count = (jump_count > MAX_JUMP_HOSTS) ? MAX_JUMP_HOSTS : jump_count;
    for (int i = 0; i < args->jump_count; i++) {
        snprintf(args->jump_hosts[i].host, sizeof(args->jump_hosts[i].host), "%s", jump_hosts[i].host);
        args->jump_hosts[i].port = jump_hosts[i].port;
        snprintf(args->jump_hosts[i].username, sizeof(args->jump_hosts[i].username), "%s", jump_hosts[i].username);
        args->jump_hosts[i].password = strdup(jump_hosts[i].password ? jump_hosts[i].password : "");
        args->jump_hosts[i].private_key = strdup(jump_hosts[i].private_key ? jump_hosts[i].private_key : "");
        args->jump_hosts[i].passphrase = strdup(jump_hosts[i].passphrase ? jump_hosts[i].passphrase : "");
    }

    pthread_t thread;
    if (pthread_create(&thread, NULL, exec_command_thread, args) != 0) {
        LOG_ERROR("Failed to create exec command thread for %s", request_id);
        exec_cmd_free(args);
        return -1;
    }
    pthread_detach(thread);
    return 0;
}
