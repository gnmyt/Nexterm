#include "connection.h"
#include "control_plane.h"
#include "ssh.h"
#include "telnet.h"
#include "websocket.h"
#include "log.h"
#include "session.h"

extern nexterm_session_manager_t g_session_manager;

#include <guacamole/client.h>
#include <guacamole/error.h>
#include <guacamole/parser.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

#define GUAC_HANDSHAKE_TIMEOUT_US 15000000

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} guac_thread_args_t;

typedef struct {
    guac_client* client;
    int fd;
    int owner;
    char session_id[MAX_SESSION_ID_LEN];
} guac_user_thread_args_t;

static void nexterm_guac_log_handler(guac_client* client,
        guac_client_log_level level, const char* format, va_list args) {
    char message[2048];
    vsnprintf(message, sizeof(message), format, args);

    switch (level) {
        case GUAC_LOG_ERROR:   LOG_ERROR("[guac:%s] %s", client->connection_id, message); break;
        case GUAC_LOG_WARNING: LOG_WARN("[guac:%s] %s", client->connection_id, message);  break;
        case GUAC_LOG_INFO:    LOG_INFO("[guac:%s] %s", client->connection_id, message);  break;
        case GUAC_LOG_DEBUG:   LOG_DEBUG("[guac:%s] %s", client->connection_id, message); break;
        case GUAC_LOG_TRACE:   LOG_TRACE("[guac:%s] %s", client->connection_id, message); break;
        default:               LOG_DEBUG("[guac:%s] %s", client->connection_id, message); break;
    }
}

static void* guac_user_thread(void* arg) {
    guac_user_thread_args_t* params = (guac_user_thread_args_t*)arg;
    guac_client* client = params->client;
    int fd = params->fd;
    int owner = params->owner;

    guac_socket* socket = guac_socket_open(fd);
    if (!socket) {
        LOG_ERROR("Failed to create guac_socket for session %s", params->session_id);
        close(fd);
        free(params);
        return NULL;
    }

    guac_parser* parser = guac_parser_alloc();
    if (!parser) {
        LOG_ERROR("Failed to allocate parser for session %s", params->session_id);
        guac_socket_free(socket);
        free(params);
        return NULL;
    }

    if (guac_parser_expect(parser, socket, GUAC_HANDSHAKE_TIMEOUT_US, "select")) {
        LOG_ERROR("Failed to read 'select' for session %s: %s",
                  params->session_id, guac_status_string(guac_error));
        guac_parser_free(parser);
        guac_socket_free(socket);
        free(params);
        return NULL;
    }

    LOG_DEBUG("Session %s: user selected '%s' (owner=%d)",
              params->session_id,
              parser->argc > 0 ? parser->argv[0] : "(none)",
              owner);
    guac_parser_free(parser);

    guac_user* user = guac_user_alloc();
    if (!user) {
        LOG_ERROR("Failed to allocate guac_user for session %s", params->session_id);
        guac_socket_free(socket);
        free(params);
        return NULL;
    }

    user->client = client;
    user->socket = socket;
    user->owner = owner;
    user->active = 1;

    if (owner) {
        int num_client_args = 0;
        while (client->args[num_client_args] != NULL)
            num_client_args++;
        LOG_INFO("Session %s: plugin expects %d args", params->session_id, num_client_args);
    }

    int result = guac_user_handle_connection(user, GUAC_HANDSHAKE_TIMEOUT_US);
    if (result != 0 && owner) {
        LOG_WARN("Guac handshake failed for session %s (code=%d)", params->session_id, result);
    }

    LOG_INFO("User disconnected from session %s (owner=%d, remaining=%d)",
             params->session_id, owner, client->connected_users);

    guac_socket_free(socket);
    guac_user_free(user);
    free(params);
    return NULL;
}

static int start_user_thread(guac_client* client, int fd, int owner,
                              const char* session_id, pthread_t* out_thread) {
    guac_user_thread_args_t* params = calloc(1, sizeof(guac_user_thread_args_t));
    if (!params) return -1;

    params->client = client;
    params->fd = fd;
    params->owner = owner;
    snprintf(params->session_id, sizeof(params->session_id), "%s", session_id);

    if (pthread_create(out_thread, NULL, guac_user_thread, params) != 0) {
        LOG_ERROR("Failed to create user thread for session %s", session_id);
        free(params);
        return -1;
    }

    return 0;
}

static const char* session_type_to_protocol(session_type_t type) {
    switch (type) {
        case SESSION_TYPE_VNC:    return "vnc";
        case SESSION_TYPE_RDP:    return "rdp";
        case SESSION_TYPE_SSH:    return "ssh";
        case SESSION_TYPE_TELNET: return "telnet";
        case SESSION_TYPE_DEMO:   return "demo";
        default:                  return NULL;
    }
}

static guac_client* guac_setup_client(nexterm_session_t* session,
                                      nexterm_control_plane_t* cp,
                                      const char* protocol_name) {
    if (socketpair(AF_UNIX, SOCK_DGRAM, 0, session->join_pipe) < 0) {
        LOG_ERROR("Failed to create join pipe for session %s: %s",
                  session->session_id, strerror(errno));
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to create join pipe", NULL);
        return NULL;
    }

    int data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        close(session->join_pipe[0]); session->join_pipe[0] = -1;
        close(session->join_pipe[1]); session->join_pipe[1] = -1;
        return NULL;
    }
    session->data_fd = data_fd;

    guac_client* client = guac_client_alloc();
    if (!client) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to allocate guac client", NULL);
        close(data_fd); session->data_fd = -1;
        close(session->join_pipe[0]); session->join_pipe[0] = -1;
        close(session->join_pipe[1]); session->join_pipe[1] = -1;
        return NULL;
    }

    client->log_handler = nexterm_guac_log_handler;

    if (guac_client_load_plugin(client, protocol_name)) {
        LOG_ERROR("Failed to load guac plugin '%s': %s",
                  protocol_name, guac_status_string(guac_error));
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to load protocol plugin", NULL);
        guac_client_free(client);
        close(data_fd); session->data_fd = -1;
        close(session->join_pipe[0]); session->join_pipe[0] = -1;
        close(session->join_pipe[1]); session->join_pipe[1] = -1;
        return NULL;
    }

    return client;
}

static int receive_join_fd(int pipe_fd) {
    struct msghdr msg = { 0 };
    struct iovec iov;
    char dummy;
    iov.iov_base = &dummy;
    iov.iov_len = 1;
    msg.msg_iov = &iov;
    msg.msg_iovlen = 1;

    char cmsg_buf[CMSG_SPACE(sizeof(int))];
    msg.msg_control = cmsg_buf;
    msg.msg_controllen = sizeof(cmsg_buf);

    ssize_t n = recvmsg(pipe_fd, &msg, 0);
    if (n <= 0) return -1;

    const struct cmsghdr* cmsg = CMSG_FIRSTHDR(&msg);
    if (cmsg && cmsg->cmsg_level == SOL_SOCKET && cmsg->cmsg_type == SCM_RIGHTS) {
        int fd;
        memcpy(&fd, CMSG_DATA(cmsg), sizeof(int));
        return fd;
    }

    return -1;
}

static void guac_accept_joins(nexterm_session_t* session, guac_client* client,
                              pthread_t* user_threads, int* user_thread_count,
                              int max_user_threads) {
    bool active = true;
    while (active && session->state == SESSION_STATE_ACTIVE) {
        struct pollfd pfd = { .fd = session->join_pipe[0], .events = POLLIN };
        int ret = poll(&pfd, 1, 1000);

        if (ret < 0) {
            if (errno != EINTR) active = false;
            continue;
        }

        if (ret == 0) {
            if (client->connected_users == 0) {
                LOG_INFO("All users disconnected from session %s", session->session_id);
                active = false;
            }
            continue;
        }

        if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) {
            active = false;
            continue;
        }

        int join_fd = receive_join_fd(session->join_pipe[0]);
        if (join_fd < 0) {
            active = false;
            continue;
        }

        LOG_INFO("Join connection received for session %s (fd=%d)", session->session_id, join_fd);

        pthread_t join_thread;
        if (start_user_thread(client, join_fd, 0, session->session_id, &join_thread) != 0) {
            close(join_fd);
            continue;
        }

        if (*user_thread_count < max_user_threads) {
            user_threads[(*user_thread_count)++] = join_thread;
        } else {
            LOG_WARN("Too many user threads for session %s, detaching overflow thread",
                     session->session_id);
            pthread_detach(join_thread);
        }
    }
}

static void* guac_session_thread(void* arg) {
    guac_thread_args_t* args = (guac_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;

    const char* protocol_name = session_type_to_protocol(session->type);
    if (!protocol_name) {
        LOG_ERROR("Unsupported session type for guac: %d", session->type);
        nexterm_sm_finish(&g_session_manager, session->session_id);
        free(args);
        return NULL;
    }

    LOG_INFO("Starting guac session %s with protocol %s", session->session_id, protocol_name);
    session->state = SESSION_STATE_CONNECTING;

    guac_client* client = guac_setup_client(session, cp, protocol_name);
    if (!client) {
        nexterm_sm_finish(&g_session_manager, session->session_id);
        free(args);
        return NULL;
    }

    session->guac_client = client;
    snprintf(session->guac_connection_id, sizeof(session->guac_connection_id),
             "%s", client->connection_id);
    guac_socket_require_keep_alive(client->socket);

    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true,
                                   NULL, client->connection_id);
    LOG_INFO("Guac session %s active (connection_id=%s)",
             session->session_id, client->connection_id);

    pthread_t user_threads[256];
    int user_thread_count = 0;

    pthread_t owner_thread;
    int owner_fd = session->data_fd;
    session->data_fd = -1;
    if (start_user_thread(client, owner_fd, 1, session->session_id, &owner_thread) != 0) {
        LOG_ERROR("Failed to start owner user thread for session %s", session->session_id);
        close(owner_fd);
        nexterm_sm_lock(&g_session_manager);
        nexterm_session_t* failed = nexterm_sm_find_locked(&g_session_manager, session->session_id);
        if (failed) failed->guac_client = NULL;
        nexterm_sm_unlock(&g_session_manager);
        guac_client_stop(client);
        guac_client_free(client);
        nexterm_cp_send_session_closed(cp, session->session_id, "internal error");
        nexterm_sm_finish(&g_session_manager, session->session_id);
        free(args);
        return NULL;
    }
    user_threads[user_thread_count++] = owner_thread;

    guac_accept_joins(session, client, user_threads, &user_thread_count,
                      (int)(sizeof(user_threads) / sizeof(user_threads[0])));

    for (int i = 0; i < user_thread_count; i++) {
        pthread_join(user_threads[i], NULL);
    }

    char session_id[MAX_SESSION_ID_LEN];
    snprintf(session_id, sizeof(session_id), "%s", session->session_id);

    LOG_INFO("Guac session %s ending", session_id);

    nexterm_sm_lock(&g_session_manager);
    nexterm_session_t* live = nexterm_sm_find_locked(&g_session_manager, session_id);
    if (live) live->guac_client = NULL;
    nexterm_sm_unlock(&g_session_manager);

    guac_client_stop(client);
    guac_client_free(client);

    char rec_path[512];
    snprintf(rec_path, sizeof(rec_path), "/tmp/nexterm-recordings/%s", session_id);
    struct stat st;
    if (stat(rec_path, &st) == 0) {
        if (st.st_size > 1024)
            nexterm_cp_upload_recording(cp, session_id, rec_path);
        else
            unlink(rec_path);
    }

    nexterm_cp_send_session_closed(cp, session_id, "session ended");
    nexterm_sm_finish(&g_session_manager, session_id);

    free(args);
    return NULL;
}

int nexterm_connection_start_guac(nexterm_session_t* session,
                                  nexterm_control_plane_t* cp) {
    guac_thread_args_t* args = calloc(1, sizeof(guac_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, guac_session_thread, args) != 0) {
        LOG_ERROR("Failed to create thread for session %s", session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}

int nexterm_connection_start_ssh(nexterm_session_t* session,
                                 nexterm_control_plane_t* cp) {
    return nexterm_ssh_start(session, cp);
}

int nexterm_connection_start_telnet(nexterm_session_t* session,
                                    nexterm_control_plane_t* cp) {
    return nexterm_telnet_start(session, cp);
}

int nexterm_connection_join_guac(nexterm_session_t* session,
                                 nexterm_control_plane_t* cp) {
    char sid[MAX_SESSION_ID_LEN];
    snprintf(sid, sizeof(sid), "%s", session->session_id);

    if (session->state != SESSION_STATE_ACTIVE) {
        LOG_WARN("Cannot join session %s: not active", sid);
        return -1;
    }

    int join_fd = nexterm_cp_open_data_connection(cp, sid);
    if (join_fd < 0) {
        LOG_ERROR("Failed to open join data connection for session %s", sid);
        return -1;
    }

    struct msghdr msg = { 0 };
    struct iovec iov;
    char dummy = 'J';
    iov.iov_base = &dummy;
    iov.iov_len = 1;
    msg.msg_iov = &iov;
    msg.msg_iovlen = 1;

    char cmsg_buf[CMSG_SPACE(sizeof(int))];
    msg.msg_control = cmsg_buf;
    msg.msg_controllen = sizeof(cmsg_buf);

    struct cmsghdr* cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type = SCM_RIGHTS;
    cmsg->cmsg_len = CMSG_LEN(sizeof(int));
    memcpy(CMSG_DATA(cmsg), &join_fd, sizeof(int));

    nexterm_sm_lock(&g_session_manager);
    nexterm_session_t* live = nexterm_sm_find_locked(&g_session_manager, sid);
    ssize_t n = -1;
    if (live && live->state == SESSION_STATE_ACTIVE && live->join_pipe[1] >= 0)
        n = sendmsg(live->join_pipe[1], &msg, 0);
    nexterm_sm_unlock(&g_session_manager);

    if (n <= 0) {
        LOG_ERROR("Failed to send join fd for session %s: %s", sid, strerror(errno));
        close(join_fd);
        return -1;
    }

    close(join_fd);
    LOG_INFO("Join fd sent to session %s", sid);
    return 0;
}

void nexterm_connection_close(nexterm_session_t* session) {
    if (session->state == SESSION_STATE_CLOSED ||
        session->state == SESSION_STATE_CLOSING)
        return;

    LOG_INFO("Closing connection for session %s", session->session_id);

    session->state = SESSION_STATE_CLOSING;

    if (session->guac_client)
        guac_client_stop((guac_client*)session->guac_client);
}
