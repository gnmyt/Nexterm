#include "ssh_common.h"

#include <stdio.h>

#include "io.h"
#include "log.h"

#include <string.h>
#include <unistd.h>

int nexterm_ssh_setup(const char* host, uint16_t port,
                      int* out_sock, LIBSSH2_SESSION** out_session) {
    int sock = nexterm_tcp_connect(host, port);
    if (sock < 0) return -1;

    LIBSSH2_SESSION* session = libssh2_session_init();
    if (!session) {
        close(sock);
        return -1;
    }

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
