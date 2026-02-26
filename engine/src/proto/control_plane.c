#include "control_plane.h"
#include "io.h"
#include "session.h"
#include "connection.h"
#include "ssh.h"
#include "telnet.h"
#include "sftp.h"
#include "log.h"

#include <errno.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <netdb.h>
#include <fcntl.h>
#include <poll.h>
#include <time.h>
#include <unistd.h>

#include "control_plane_builder.h"
#include "control_plane_reader.h"

#define CP_MAX_FRAME_SIZE (16 * 1024 * 1024)

extern nexterm_session_manager_t g_session_manager;

static int finalize_and_send(flatcc_builder_t* b, int fd, pthread_mutex_t* mutex) {
    size_t size;
    uint8_t* buf = (uint8_t*)flatcc_builder_finalize_buffer(b, &size);
    int ret = nexterm_send_frame(fd, buf, size, mutex);
    flatcc_builder_clear(b);
    free(buf);
    return ret;
}

static int cp_send(nexterm_control_plane_t* cp, flatcc_builder_t* b) {
    return finalize_and_send(b, cp->sock_fd, &cp->send_mutex);
}

static int send_engine_hello(nexterm_control_plane_t* cp) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_EngineHello);
    Nexterm_ControlPlane_Envelope_engine_hello_start(&builder);
    Nexterm_ControlPlane_EngineHello_version_create_str(&builder, NEXTERM_ENGINE_VERSION);
    if (cp->registration_token && cp->registration_token[0] != '\0')
        Nexterm_ControlPlane_EngineHello_registration_token_create_str(&builder, cp->registration_token);
    Nexterm_ControlPlane_Envelope_engine_hello_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

static int send_pong(nexterm_control_plane_t* cp, uint64_t timestamp) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_Pong);
    Nexterm_ControlPlane_Envelope_pong_start(&builder);
    Nexterm_ControlPlane_Pong_timestamp_add(&builder, timestamp);
    Nexterm_ControlPlane_Envelope_pong_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

static session_type_t map_session_type(Nexterm_ControlPlane_SessionType_enum_t t) {
    switch (t) {
        case Nexterm_ControlPlane_SessionType_VNC:    return SESSION_TYPE_VNC;
        case Nexterm_ControlPlane_SessionType_RDP:    return SESSION_TYPE_RDP;
        case Nexterm_ControlPlane_SessionType_SSH:    return SESSION_TYPE_SSH;
        case Nexterm_ControlPlane_SessionType_SFTP:   return SESSION_TYPE_SFTP;
        case Nexterm_ControlPlane_SessionType_Telnet: return SESSION_TYPE_TELNET;
        case Nexterm_ControlPlane_SessionType_Tunnel: return SESSION_TYPE_TUNNEL;
        default: return SESSION_TYPE_VNC;
    }
}

static int start_session_connection(nexterm_session_t* session,
                                    nexterm_control_plane_t* cp,
                                    session_type_t stype) {
    switch (stype) {
        case SESSION_TYPE_VNC:
        case SESSION_TYPE_RDP:
            return nexterm_connection_start_guac(session, cp);
        case SESSION_TYPE_SSH:
            return nexterm_connection_start_ssh(session, cp);
        case SESSION_TYPE_TELNET:
            return nexterm_connection_start_telnet(session, cp);
        case SESSION_TYPE_SFTP:
            return nexterm_sftp_start(session, cp);
        case SESSION_TYPE_TUNNEL:
            return nexterm_tunnel_start(session, cp);
        default:
            LOG_WARN("Unsupported session type: %d", stype);
            return -1;
    }
}

static void handle_engine_hello_ack(nexterm_control_plane_t* cp,
                                    Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_EngineHelloAck_table_t ack =
        Nexterm_ControlPlane_Envelope_engine_hello_ack(envelope);
    if (ack && Nexterm_ControlPlane_EngineHelloAck_accepted(ack)) {
        LOG_INFO("Server accepted engine (server version: %s)",
                 Nexterm_ControlPlane_EngineHelloAck_server_version(ack));
        cp->connected = true;
    } else {
        LOG_ERROR("Server rejected engine connection");
        cp->running = false;
    }
}

static void handle_ping(nexterm_control_plane_t* cp,
                        Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_Ping_table_t ping =
        Nexterm_ControlPlane_Envelope_ping(envelope);
    uint64_t ts = ping ? Nexterm_ControlPlane_Ping_timestamp(ping) : 0;
    send_pong(cp, ts);
    LOG_TRACE("Ping/Pong (ts=%lu)", (unsigned long)ts);
}

static void store_jump_hosts_as_params(nexterm_session_t* session,
                                       Nexterm_ControlPlane_JumpHost_vec_t jump_hosts) {
    if (!jump_hosts) return;
    size_t count = Nexterm_ControlPlane_JumpHost_vec_len(jump_hosts);
    if (count == 0) return;
    if (count > MAX_JUMP_HOSTS) count = MAX_JUMP_HOSTS;

    char buf[32];
    snprintf(buf, sizeof(buf), "%zu", count);
    nexterm_session_add_param(session, "jumpHostCount", buf);

    for (size_t i = 0; i < count; i++) {
        Nexterm_ControlPlane_JumpHost_table_t jh =
            Nexterm_ControlPlane_JumpHost_vec_at(jump_hosts, i);
        char key[64];

        const char* host = Nexterm_ControlPlane_JumpHost_host(jh);
        snprintf(key, sizeof(key), "jumpHost%zu_host", i);
        nexterm_session_add_param(session, key, host ? host : "");

        snprintf(key, sizeof(key), "jumpHost%zu_port", i);
        snprintf(buf, sizeof(buf), "%u", Nexterm_ControlPlane_JumpHost_port(jh));
        nexterm_session_add_param(session, key, buf);

        const char* username = Nexterm_ControlPlane_JumpHost_username(jh);
        snprintf(key, sizeof(key), "jumpHost%zu_username", i);
        nexterm_session_add_param(session, key, username ? username : "");

        const char* password = Nexterm_ControlPlane_JumpHost_password(jh);
        snprintf(key, sizeof(key), "jumpHost%zu_password", i);
        nexterm_session_add_param(session, key, password ? password : "");

        const char* private_key = Nexterm_ControlPlane_JumpHost_private_key(jh);
        snprintf(key, sizeof(key), "jumpHost%zu_privateKey", i);
        nexterm_session_add_param(session, key, private_key ? private_key : "");

        const char* passphrase = Nexterm_ControlPlane_JumpHost_passphrase(jh);
        snprintf(key, sizeof(key), "jumpHost%zu_passphrase", i);
        nexterm_session_add_param(session, key, passphrase ? passphrase : "");
    }
}

static void extract_jump_hosts_from_msg(Nexterm_ControlPlane_JumpHost_vec_t jh_vec,
                                        jump_host_t* jump_hosts, int* jump_count) {
    *jump_count = 0;
    if (!jh_vec) return;
    size_t count = Nexterm_ControlPlane_JumpHost_vec_len(jh_vec);
    if (count == 0) return;
    if (count > MAX_JUMP_HOSTS) count = MAX_JUMP_HOSTS;

    for (size_t i = 0; i < count; i++) {
        Nexterm_ControlPlane_JumpHost_table_t jh =
            Nexterm_ControlPlane_JumpHost_vec_at(jh_vec, i);
        memset(&jump_hosts[i], 0, sizeof(jump_host_t));

        const char* host = Nexterm_ControlPlane_JumpHost_host(jh);
        if (host) snprintf(jump_hosts[i].host, sizeof(jump_hosts[i].host), "%s", host);
        jump_hosts[i].port = Nexterm_ControlPlane_JumpHost_port(jh);

        const char* username = Nexterm_ControlPlane_JumpHost_username(jh);
        if (username) snprintf(jump_hosts[i].username, sizeof(jump_hosts[i].username), "%s", username);

        jump_hosts[i].password = (char*)Nexterm_ControlPlane_JumpHost_password(jh);
        jump_hosts[i].private_key = (char*)Nexterm_ControlPlane_JumpHost_private_key(jh);
        jump_hosts[i].passphrase = (char*)Nexterm_ControlPlane_JumpHost_passphrase(jh);
    }
    *jump_count = (int)count;
}

static void handle_session_open(nexterm_control_plane_t* cp,
                                Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_SessionOpen_table_t open_msg =
        Nexterm_ControlPlane_Envelope_session_open(envelope);
    if (!open_msg) {
        LOG_WARN("Invalid SessionOpen message");
        return;
    }

    const char* sid = Nexterm_ControlPlane_SessionOpen_session_id(open_msg);
    const char* host = Nexterm_ControlPlane_SessionOpen_host(open_msg);
    uint16_t port = Nexterm_ControlPlane_SessionOpen_port(open_msg);
    session_type_t stype = map_session_type(
        Nexterm_ControlPlane_SessionOpen_session_type(open_msg));

    LOG_INFO("SessionOpen: id=%s type=%d host=%s port=%u", sid, stype, host, port);

    nexterm_session_t* session = nexterm_sm_create(
        &g_session_manager, sid, stype, host, port);

    if (!session) {
        nexterm_cp_send_session_result(cp, sid, false,
            "Failed to create session", NULL);
        return;
    }

    Nexterm_ControlPlane_ConnectionParam_vec_t params =
        Nexterm_ControlPlane_SessionOpen_params(open_msg);
    if (params) {
        size_t n = Nexterm_ControlPlane_ConnectionParam_vec_len(params);
        for (size_t i = 0; i < n; i++) {
            Nexterm_ControlPlane_ConnectionParam_table_t p =
                Nexterm_ControlPlane_ConnectionParam_vec_at(params, i);
            nexterm_session_add_param(session,
                Nexterm_ControlPlane_ConnectionParam_key(p),
                Nexterm_ControlPlane_ConnectionParam_value(p));
        }
    }

    store_jump_hosts_as_params(session,
        Nexterm_ControlPlane_SessionOpen_jump_hosts(open_msg));

    if (start_session_connection(session, cp, stype) != 0) {
        nexterm_cp_send_session_result(cp, sid, false,
            "Failed to start connection", NULL);
        nexterm_sm_remove(&g_session_manager, sid);
    }
}

static void handle_session_close(nexterm_control_plane_t* cp,
                                 Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_SessionClose_table_t close_msg =
        Nexterm_ControlPlane_Envelope_session_close(envelope);
    if (!close_msg) return;

    const char* sid = Nexterm_ControlPlane_SessionClose_session_id(close_msg);
    LOG_INFO("SessionClose: id=%s", sid);

    nexterm_session_t* session = nexterm_sm_find(&g_session_manager, sid);
    if (session) {
        nexterm_connection_close(session);
        nexterm_cp_send_session_closed(cp, sid, "closed by server");
        nexterm_sm_remove(&g_session_manager, sid);
    }
}

static void handle_session_resize(Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_SessionResize_table_t resize_msg =
        Nexterm_ControlPlane_Envelope_session_resize(envelope);
    if (!resize_msg) return;

    const char* sid = Nexterm_ControlPlane_SessionResize_session_id(resize_msg);
    uint16_t cols = Nexterm_ControlPlane_SessionResize_cols(resize_msg);
    uint16_t rows = Nexterm_ControlPlane_SessionResize_rows(resize_msg);

    LOG_DEBUG("SessionResize: id=%s cols=%u rows=%u", sid, cols, rows);

    nexterm_session_t* session = nexterm_sm_find(&g_session_manager, sid);
    if (session && session->type == SESSION_TYPE_SSH)
        nexterm_ssh_resize(session, cols, rows);
    else if (session && session->type == SESSION_TYPE_TELNET)
        nexterm_telnet_resize(session, cols, rows);
}

static void handle_session_join(nexterm_control_plane_t* cp,
                                Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_SessionJoin_table_t join_msg =
        Nexterm_ControlPlane_Envelope_session_join(envelope);
    if (!join_msg) return;

    const char* sid = Nexterm_ControlPlane_SessionJoin_session_id(join_msg);
    LOG_INFO("SessionJoin: id=%s", sid);

    nexterm_session_t* session = nexterm_sm_find(&g_session_manager, sid);
    if (session) {
        if (nexterm_connection_join_guac(session, cp) != 0)
            LOG_WARN("Failed to join session %s", sid);
    } else {
        LOG_WARN("SessionJoin: session not found: %s", sid);
    }
}

static void extract_ssh_credentials(Nexterm_ControlPlane_ConnectionParam_vec_t params,
                                    ssh_credentials_t* creds) {
    creds->username = NULL;
    creds->password = NULL;
    creds->private_key = NULL;
    creds->passphrase = NULL;
    if (!params) return;

    size_t n = Nexterm_ControlPlane_ConnectionParam_vec_len(params);
    for (size_t i = 0; i < n; i++) {
        Nexterm_ControlPlane_ConnectionParam_table_t p =
            Nexterm_ControlPlane_ConnectionParam_vec_at(params, i);
        const char* key = Nexterm_ControlPlane_ConnectionParam_key(p);
        const char* val = Nexterm_ControlPlane_ConnectionParam_value(p);
        if (strcmp(key, "username") == 0) creds->username = val;
        else if (strcmp(key, "password") == 0) creds->password = val;
        else if (strcmp(key, "privateKey") == 0) creds->private_key = val;
        else if (strcmp(key, "passphrase") == 0) creds->passphrase = val;
    }
}

static void handle_exec_command(nexterm_control_plane_t* cp,
                                Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_ExecCommand_table_t exec_msg =
        Nexterm_ControlPlane_Envelope_exec_command(envelope);
    if (!exec_msg) {
        LOG_WARN("Invalid ExecCommand message");
        return;
    }

    const char* req_id = Nexterm_ControlPlane_ExecCommand_request_id(exec_msg);
    const char* host = Nexterm_ControlPlane_ExecCommand_host(exec_msg);
    uint16_t port = Nexterm_ControlPlane_ExecCommand_port(exec_msg);
    const char* command = Nexterm_ControlPlane_ExecCommand_command(exec_msg);

    if (!req_id || !host || !command) {
        LOG_WARN("ExecCommand: missing required fields");
        return;
    }

    ssh_credentials_t creds;
    extract_ssh_credentials(Nexterm_ControlPlane_ExecCommand_params(exec_msg), &creds);
    if (!creds.username) creds.username = "";

    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count = 0;
    extract_jump_hosts_from_msg(
        Nexterm_ControlPlane_ExecCommand_jump_hosts(exec_msg),
        jump_hosts, &jump_count);

    LOG_INFO("ExecCommand: req=%s host=%s:%u cmd=%.64s... (jump_hosts=%d)",
             req_id, host, port, command, jump_count);

    nexterm_ssh_exec_command(cp, req_id, host, port, &creds, command,
                             jump_hosts, jump_count);
}

static bool check_port_open(const char* host, uint16_t port, uint32_t timeout_ms) {
    struct addrinfo hints = {0};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    char port_str[8];
    snprintf(port_str, sizeof(port_str), "%u", port);

    struct addrinfo* res = NULL;
    if (getaddrinfo(host, port_str, &hints, &res) != 0 || !res) {
        if (res) freeaddrinfo(res);
        return false;
    }

    int fd = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (fd < 0) {
        freeaddrinfo(res);
        return false;
    }

    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    int rc = connect(fd, res->ai_addr, res->ai_addrlen);
    freeaddrinfo(res);

    if (rc == 0) {
        close(fd);
        return true;
    }

    if (errno != EINPROGRESS) {
        close(fd);
        return false;
    }

    struct pollfd pfd = { .fd = fd, .events = POLLOUT };
    rc = poll(&pfd, 1, (int)timeout_ms);

    if (rc <= 0) {
        close(fd);
        return false;
    }

    int err = 0;
    socklen_t len = sizeof(err);
    getsockopt(fd, SOL_SOCKET, SO_ERROR, &err, &len);
    close(fd);
    return err == 0;
}

typedef struct {
    nexterm_control_plane_t* cp;
    char* request_id;
    char** ids;
    char** hosts;
    uint16_t* ports;
    size_t count;
    uint32_t timeout_ms;
} port_check_ctx_t;

static void free_port_check_ctx(port_check_ctx_t* ctx) {
    for (size_t i = 0; i < ctx->count; i++) {
        free(ctx->ids[i]);
        free(ctx->hosts[i]);
    }
    free(ctx->ids);
    free(ctx->hosts);
    free(ctx->ports);
    free(ctx->request_id);
    free(ctx);
}

static void* port_check_thread(void* arg) {
    port_check_ctx_t* ctx = (port_check_ctx_t*)arg;
    bool* results = calloc(ctx->count, sizeof(bool));
    if (!results) {
        free_port_check_ctx(ctx);
        return NULL;
    }

    for (size_t i = 0; i < ctx->count; i++)
        results[i] = check_port_open(ctx->hosts[i], ctx->ports[i], ctx->timeout_ms);

    nexterm_cp_send_port_check_result(ctx->cp, ctx->request_id,
                                      (const char**)ctx->ids, results, ctx->count);
    free(results);
    free_port_check_ctx(ctx);
    return NULL;
}

static void handle_port_check(nexterm_control_plane_t* cp,
                               Nexterm_ControlPlane_Envelope_table_t envelope) {
    Nexterm_ControlPlane_PortCheck_table_t pc_msg =
        Nexterm_ControlPlane_Envelope_port_check(envelope);
    if (!pc_msg) return;

    const char* req_id = Nexterm_ControlPlane_PortCheck_request_id(pc_msg);
    uint32_t timeout_ms = Nexterm_ControlPlane_PortCheck_timeout_ms(pc_msg);
    if (timeout_ms == 0) timeout_ms = 2000;

    Nexterm_ControlPlane_PortCheckTarget_vec_t targets =
        Nexterm_ControlPlane_PortCheck_targets(pc_msg);
    size_t count = targets ? Nexterm_ControlPlane_PortCheckTarget_vec_len(targets) : 0;
    if (!req_id || count == 0) return;

    port_check_ctx_t* ctx = calloc(1, sizeof(port_check_ctx_t));
    ctx->cp = cp;
    ctx->request_id = strdup(req_id);
    ctx->count = count;
    ctx->timeout_ms = timeout_ms;
    ctx->ids = calloc(count, sizeof(char*));
    ctx->hosts = calloc(count, sizeof(char*));
    ctx->ports = calloc(count, sizeof(uint16_t));

    for (size_t i = 0; i < count; i++) {
        Nexterm_ControlPlane_PortCheckTarget_table_t t =
            Nexterm_ControlPlane_PortCheckTarget_vec_at(targets, i);
        ctx->ids[i] = strdup(Nexterm_ControlPlane_PortCheckTarget_id(t));
        ctx->hosts[i] = strdup(Nexterm_ControlPlane_PortCheckTarget_host(t));
        ctx->ports[i] = Nexterm_ControlPlane_PortCheckTarget_port(t);
    }

    pthread_t thread;
    if (pthread_create(&thread, NULL, port_check_thread, ctx) != 0) {
        free_port_check_ctx(ctx);
        return;
    }
    pthread_detach(thread);
}

static void handle_message(nexterm_control_plane_t* cp, const uint8_t* buf) {
    Nexterm_ControlPlane_Envelope_table_t envelope = Nexterm_ControlPlane_Envelope_as_root(buf);
    if (!envelope) {
        LOG_WARN("Failed to parse envelope");
        return;
    }

    switch (Nexterm_ControlPlane_Envelope_msg_type(envelope)) {
        case Nexterm_ControlPlane_MessageType_EngineHelloAck:
            handle_engine_hello_ack(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_Ping:
            handle_ping(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_Pong: {
            Nexterm_ControlPlane_Pong_table_t pong =
                Nexterm_ControlPlane_Envelope_pong(envelope);
            uint64_t ts = pong ? Nexterm_ControlPlane_Pong_timestamp(pong) : 0;
            LOG_TRACE("Pong received (ts=%lu)", (unsigned long)ts);
            break;
        }
        case Nexterm_ControlPlane_MessageType_SessionOpen:
            handle_session_open(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_SessionClose:
            handle_session_close(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_SessionResize:
            handle_session_resize(envelope);
            break;
        case Nexterm_ControlPlane_MessageType_SessionJoin:
            handle_session_join(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_ExecCommand:
            handle_exec_command(cp, envelope);
            break;
        case Nexterm_ControlPlane_MessageType_PortCheck:
            handle_port_check(cp, envelope);
            break;
        default:
            LOG_WARN("Unknown message type: %d",
                     Nexterm_ControlPlane_Envelope_msg_type(envelope));
            break;
    }
}

static bool read_one_frame(nexterm_control_plane_t* cp) {
    uint32_t payload_len;
    uint8_t* payload = nexterm_read_frame(cp->sock_fd, CP_MAX_FRAME_SIZE, &payload_len);
    if (!payload) {
        if (cp->running) {
            LOG_WARN("Control plane connection lost");
            cp->connected = false;
        }
        return false;
    }

    handle_message(cp, payload);
    free(payload);
    return true;
}

static void* read_loop(void* arg) {
    nexterm_control_plane_t* cp = (nexterm_control_plane_t*)arg;
    while (cp->running && read_one_frame(cp));
    cp->running = false;
    return NULL;
}

static int send_ping(nexterm_control_plane_t* cp) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_Ping);
    Nexterm_ControlPlane_Envelope_ping_start(&builder);

    struct timespec now;
    clock_gettime(CLOCK_REALTIME, &now);
    Nexterm_ControlPlane_Ping_timestamp_add(&builder,
        (uint64_t)now.tv_sec * 1000 + now.tv_nsec / 1000000);

    Nexterm_ControlPlane_Envelope_ping_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

static void* keepalive_loop(void* arg) {
    nexterm_control_plane_t* cp = (nexterm_control_plane_t*)arg;

    while (cp->running) {
        struct timespec ts;
        ts.tv_sec = cp->keepalive_interval_ms / 1000;
        ts.tv_nsec = (cp->keepalive_interval_ms % 1000) * 1000000L;
        nanosleep(&ts, NULL);

        if (!cp->running || !cp->connected) continue;

        if (send_ping(cp) != 0)
            LOG_WARN("Failed to send keepalive ping");
    }

    return NULL;
}

nexterm_control_plane_t* nexterm_cp_create(const char* server_host,
                                           uint16_t server_port,
                                           const char* registration_token) {
    nexterm_control_plane_t* cp = calloc(1, sizeof(nexterm_control_plane_t));
    if (!cp) return NULL;

    cp->server_host = strdup(server_host);
    cp->server_port = server_port;
    cp->registration_token = registration_token ? strdup(registration_token) : strdup("");

    if (!cp->server_host || !cp->registration_token) {
        free(cp->server_host);
        free(cp->registration_token);
        free(cp);
        return NULL;
    }

    cp->sock_fd = -1;
    cp->connected = false;
    cp->running = false;
    cp->keepalive_interval_ms = 10000;
    cp->reconnect_delay_ms = 5000;

    pthread_mutex_init(&cp->send_mutex, NULL);
    return cp;
}

int nexterm_cp_start(nexterm_control_plane_t* cp) {
    LOG_INFO("Connecting to control plane at %s:%u", cp->server_host, cp->server_port);

    cp->sock_fd = nexterm_tcp_connect(cp->server_host, cp->server_port);
    if (cp->sock_fd < 0) {
        LOG_ERROR("Failed to connect to control plane");
        return -1;
    }

    cp->running = true;

    if (send_engine_hello(cp) != 0) {
        LOG_ERROR("Failed to send EngineHello");
        close(cp->sock_fd);
        cp->sock_fd = -1;
        cp->running = false;
        return -1;
    }

    if (pthread_create(&cp->read_thread, NULL, read_loop, cp) != 0) {
        LOG_ERROR("Failed to start read thread");
        close(cp->sock_fd);
        cp->sock_fd = -1;
        cp->running = false;
        return -1;
    }

    if (pthread_create(&cp->keepalive_thread, NULL, keepalive_loop, cp) != 0) {
        LOG_ERROR("Failed to start keepalive thread");
        cp->running = false;
        pthread_join(cp->read_thread, NULL);
        close(cp->sock_fd);
        cp->sock_fd = -1;
        return -1;
    }

    LOG_INFO("Control plane client started");
    return 0;
}

void nexterm_cp_stop(nexterm_control_plane_t* cp) {
    if (!cp->running) return;

    LOG_INFO("Stopping control plane client");
    cp->running = false;

    if (cp->sock_fd >= 0) {
        shutdown(cp->sock_fd, SHUT_RDWR);
        close(cp->sock_fd);
        cp->sock_fd = -1;
    }

    pthread_join(cp->read_thread, NULL);
    pthread_join(cp->keepalive_thread, NULL);
}

void nexterm_cp_destroy(nexterm_control_plane_t* cp) {
    if (!cp) return;
    nexterm_cp_stop(cp);
    pthread_mutex_destroy(&cp->send_mutex);
    free(cp->server_host);
    free(cp->registration_token);
    free(cp);
}

int nexterm_cp_send(nexterm_control_plane_t* cp, const uint8_t* buf, size_t len) {
    if (!cp->connected || cp->sock_fd < 0) return -1;
    return nexterm_send_frame(cp->sock_fd, buf, len, &cp->send_mutex);
}

int nexterm_cp_send_session_result(nexterm_control_plane_t* cp,
                                   const char* session_id,
                                   bool success,
                                   const char* error_message,
                                   const char* connection_id) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_SessionOpenResult);

    Nexterm_ControlPlane_Envelope_session_open_result_start(&builder);
    Nexterm_ControlPlane_SessionOpenResult_session_id_create_str(&builder, session_id);
    Nexterm_ControlPlane_SessionOpenResult_success_add(&builder, success);

    if (!success) {
        Nexterm_ControlPlane_SessionOpenResult_error_code_add(&builder,
            Nexterm_ControlPlane_ErrorCode_ConnectionFailed);
        if (error_message)
            Nexterm_ControlPlane_SessionOpenResult_error_message_create_str(&builder, error_message);
    }

    if (connection_id)
        Nexterm_ControlPlane_SessionOpenResult_connection_id_create_str(&builder, connection_id);

    Nexterm_ControlPlane_Envelope_session_open_result_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

int nexterm_cp_send_session_closed(nexterm_control_plane_t* cp,
                                    const char* session_id,
                                    const char* reason) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_SessionClosed);

    Nexterm_ControlPlane_Envelope_session_closed_start(&builder);
    Nexterm_ControlPlane_SessionClosed_session_id_create_str(&builder, session_id);
    if (reason)
        Nexterm_ControlPlane_SessionClosed_reason_create_str(&builder, reason);
    Nexterm_ControlPlane_Envelope_session_closed_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

int nexterm_cp_open_data_connection(const nexterm_control_plane_t* cp,
                                    const char* session_id) {
    LOG_DEBUG("Opening data connection for session %s", session_id);

    int data_fd = nexterm_tcp_connect(cp->server_host, cp->server_port);
    if (data_fd < 0) {
        LOG_ERROR("Failed to open data connection for session %s", session_id);
        return -1;
    }

    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_ConnectionReady);
    Nexterm_ControlPlane_Envelope_connection_ready_start(&builder);
    Nexterm_ControlPlane_ConnectionReady_session_id_create_str(&builder, session_id);
    Nexterm_ControlPlane_Envelope_connection_ready_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    if (finalize_and_send(&builder, data_fd, NULL) != 0) {
        LOG_ERROR("Failed to send ConnectionReady for session %s", session_id);
        close(data_fd);
        return -1;
    }

    LOG_DEBUG("Data connection established for session %s (fd=%d)", session_id, data_fd);
    return data_fd;
}

int nexterm_cp_send_exec_result(nexterm_control_plane_t* cp,
                                const char* request_id,
                                bool success,
                                const char* stdout_data,
                                const char* stderr_data,
                                int32_t exit_code,
                                const char* error_message) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder,
        Nexterm_ControlPlane_MessageType_ExecCommandResult);

    Nexterm_ControlPlane_Envelope_exec_command_result_start(&builder);
    Nexterm_ControlPlane_ExecCommandResult_request_id_create_str(&builder, request_id);
    Nexterm_ControlPlane_ExecCommandResult_success_add(&builder, success);
    Nexterm_ControlPlane_ExecCommandResult_exit_code_add(&builder, exit_code);

    if (stdout_data)
        Nexterm_ControlPlane_ExecCommandResult_stdout_data_create_str(&builder, stdout_data);
    if (stderr_data)
        Nexterm_ControlPlane_ExecCommandResult_stderr_data_create_str(&builder, stderr_data);
    if (error_message)
        Nexterm_ControlPlane_ExecCommandResult_error_message_create_str(&builder, error_message);

    Nexterm_ControlPlane_Envelope_exec_command_result_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}

int nexterm_cp_send_port_check_result(nexterm_control_plane_t* cp,
                                       const char* request_id,
                                       const char** ids,
                                       const bool* online,
                                       size_t count) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder,
        Nexterm_ControlPlane_MessageType_PortCheckResult);

    Nexterm_ControlPlane_Envelope_port_check_result_start(&builder);
    Nexterm_ControlPlane_PortCheckResult_request_id_create_str(&builder, request_id);

    Nexterm_ControlPlane_PortCheckResult_results_start(&builder);
    for (size_t i = 0; i < count; i++) {
        Nexterm_ControlPlane_PortCheckResult_results_push_start(&builder);
        Nexterm_ControlPlane_PortCheckEntry_id_create_str(&builder, ids[i]);
        Nexterm_ControlPlane_PortCheckEntry_online_add(&builder, online[i]);
        Nexterm_ControlPlane_PortCheckResult_results_push_end(&builder);
    }
    Nexterm_ControlPlane_PortCheckResult_results_end(&builder);

    Nexterm_ControlPlane_Envelope_port_check_result_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    return cp_send(cp, &builder);
}
