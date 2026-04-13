#include "telnet.h"
#include "control_plane.h"
#include "io.h"
#include "log.h"

#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define TELNET_BUF_SIZE 16384

#define IAC   255
#define DONT  254
#define DO    253
#define WONT  252
#define WILL  251
#define SB    250
#define SE    240

#define TELOPT_ECHO    1
#define TELOPT_SGA     3
#define TELOPT_TTYPE  24
#define TELOPT_NAWS   31

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} telnet_thread_args_t;

static int telnet_send_cmd(int fd, uint8_t cmd, uint8_t option) {
    uint8_t buf[3] = { IAC, cmd, option };
    return nexterm_write_exact(fd, buf, 3);
}

static int telnet_send_naws(int fd, uint16_t cols, uint16_t rows) {
    uint8_t buf[9] = {
        IAC, SB, TELOPT_NAWS,
        (cols >> 8) & 0xFF, cols & 0xFF,
        (rows >> 8) & 0xFF, rows & 0xFF,
        IAC, SE
    };
    return nexterm_write_exact(fd, buf, 9);
}

static int telnet_send_ttype(int fd) {
    static const char term[] = "xterm-256color";
    uint8_t buf[6 + sizeof(term) - 1] = { IAC, SB, TELOPT_TTYPE, 0 };
    memcpy(buf + 4, term, sizeof(term) - 1);
    buf[4 + sizeof(term) - 1] = IAC;
    buf[5 + sizeof(term) - 1] = SE;
    return nexterm_write_exact(fd, buf, sizeof(buf));
}

static void handle_do(int fd, uint8_t opt) {
    if (opt == TELOPT_NAWS || opt == TELOPT_TTYPE)
        telnet_send_cmd(fd, WILL, opt);
    else
        telnet_send_cmd(fd, WONT, opt);
}

static void handle_will(int fd, uint8_t opt) {
    if (opt == TELOPT_ECHO || opt == TELOPT_SGA)
        telnet_send_cmd(fd, DO, opt);
    else
        telnet_send_cmd(fd, DONT, opt);
}

static void handle_negotiation(int fd, uint8_t cmd, uint8_t opt) {
    switch (cmd) {
        case DO:   handle_do(fd, opt);                  break;
        case DONT: telnet_send_cmd(fd, WONT, opt);      break;
        case WILL: handle_will(fd, opt);                break;
        case WONT: telnet_send_cmd(fd, DONT, opt);      break;
        default: break;
    }
}

static size_t handle_subnegotiation(int fd, const uint8_t* buf,
                                    size_t i, size_t len) {
    size_t j = i + 3;
    while (j + 1 < len && !(buf[j] == IAC && buf[j + 1] == SE))
        j++;

    if (j + 1 >= len)
        return len;

    if (buf[i + 2] == TELOPT_TTYPE)
        telnet_send_ttype(fd);

    return j + 2;
}

static int telnet_process_and_forward(int telnet_fd, int data_fd,
                                      const uint8_t* buf, size_t len) {
    uint8_t out[TELNET_BUF_SIZE];
    size_t out_pos = 0;
    size_t i = 0;

    while (i < len) {
        if (buf[i] != IAC || i + 1 >= len) {
            if (out_pos < sizeof(out))
                out[out_pos++] = buf[i];
            i++;
            continue;
        }

        uint8_t cmd = buf[i + 1];

        if (cmd == IAC) {
            if (out_pos < sizeof(out)) out[out_pos++] = IAC;
            i += 2;
        } else if ((cmd >= WILL && cmd <= DONT) && i + 2 < len) {
            handle_negotiation(telnet_fd, cmd, buf[i + 2]);
            i += 3;
        } else if (cmd == SB && i + 2 < len) {
            i = handle_subnegotiation(telnet_fd, buf, i, len);
        } else {
            i += 2;
        }
    }

    if (out_pos > 0)
        return nexterm_write_exact(data_fd, out, out_pos);

    return 0;
}

static bool telnet_bridge_poll(int data_fd, int telnet_fd) {
    uint8_t buf[TELNET_BUF_SIZE];
    struct pollfd fds[2] = {
        { .fd = data_fd,   .events = POLLIN },
        { .fd = telnet_fd, .events = POLLIN },
    };

    int ret = poll(fds, 2, 200);
    if (ret < 0)
        return errno == EINTR;
    if (ret == 0)
        return true;

    if (fds[0].revents & POLLIN) {
        ssize_t n = read(data_fd, buf, sizeof(buf));
        if (n <= 0) return false;
        if (nexterm_write_exact(telnet_fd, buf, (size_t)n) != 0) return false;
    }

    if (fds[1].revents & POLLIN) {
        ssize_t n = read(telnet_fd, buf, sizeof(buf));
        if (n <= 0) return false;
        if (telnet_process_and_forward(telnet_fd, data_fd, buf, (size_t)n) != 0)
            return false;
    }

    if (fds[0].revents & (POLLERR | POLLHUP))
        return false;
    if (fds[1].revents & (POLLERR | POLLHUP))
        return false;

    return true;
}

static void* telnet_session_thread(void* arg) {
    telnet_thread_args_t* args = (telnet_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    int telnet_fd = -1;

    session->state = SESSION_STATE_CONNECTING;

    LOG_INFO("Telnet session %s: connecting to %s:%u",
             session->session_id, session->host, session->port);

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    telnet_fd = nexterm_tcp_connect(session->host, session->port);
    if (telnet_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to telnet host", NULL);
        close(data_fd);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    session->telnet_sock = telnet_fd;
    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    LOG_INFO("Telnet session %s active (target=%s:%u)",
             session->session_id, session->host, session->port);

    while (session->state == SESSION_STATE_ACTIVE
            && telnet_bridge_poll(data_fd, telnet_fd));

    LOG_INFO("Telnet session %s ending", session->session_id);

    session->telnet_sock = -1;

    if (telnet_fd >= 0)
        close(telnet_fd);
    if (data_fd >= 0)
        close(data_fd);

    session->state = SESSION_STATE_CLOSED;
    nexterm_cp_send_session_closed(cp, session->session_id, "session ended");

    free(args);
    return NULL;
}

int nexterm_telnet_start(nexterm_session_t* session,
                         nexterm_control_plane_t* cp) {
    telnet_thread_args_t* args = calloc(1, sizeof(telnet_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, telnet_session_thread, args) != 0) {
        LOG_ERROR("Failed to create telnet thread for session %s",
                  session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}

void nexterm_telnet_resize(nexterm_session_t* session,
                           uint16_t cols, uint16_t rows) {
    int fd = session->telnet_sock;
    if (fd < 0 || session->state != SESSION_STATE_ACTIVE) return;

    if (telnet_send_naws(fd, cols, rows) != 0)
        LOG_WARN("Telnet session %s: NAWS resize failed",
                 session->session_id);
    else
        LOG_DEBUG("Telnet session %s: resized to %ux%u",
                  session->session_id, cols, rows);
}
