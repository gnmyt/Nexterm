#ifndef NEXTERM_CONTROL_PLANE_H
#define NEXTERM_CONTROL_PLANE_H

#include <stdint.h>
#include <stdbool.h>
#include <pthread.h>

#define NEXTERM_ENGINE_VERSION "0.1.0"

typedef struct nexterm_control_plane {
    int sock_fd;
    bool connected;
    bool running;

    char* server_host;
    uint16_t server_port;

    char* registration_token;

    pthread_t read_thread;
    pthread_t keepalive_thread;
    uint32_t keepalive_interval_ms;
    uint32_t reconnect_delay_ms;

    pthread_mutex_t send_mutex;
} nexterm_control_plane_t;

nexterm_control_plane_t* nexterm_cp_create(const char* server_host,
                                           uint16_t server_port,
                                           const char* registration_token);

int nexterm_cp_start(nexterm_control_plane_t* cp);

void nexterm_cp_stop(nexterm_control_plane_t* cp);

void nexterm_cp_destroy(nexterm_control_plane_t* cp);

int nexterm_cp_send(nexterm_control_plane_t* cp, const uint8_t* buf, size_t len);

int nexterm_cp_send_session_result(nexterm_control_plane_t* cp,
                                   const char* session_id,
                                   bool success,
                                   const char* error_message,
                                   const char* connection_id);

int nexterm_cp_send_session_closed(nexterm_control_plane_t* cp,
                                    const char* session_id,
                                    const char* reason);

int nexterm_cp_open_data_connection(const nexterm_control_plane_t* cp,
                                    const char* session_id);

int nexterm_cp_send_exec_result(nexterm_control_plane_t* cp,
                                const char* request_id,
                                bool success,
                                const char* stdout_data,
                                const char* stderr_data,
                                int32_t exit_code,
                                const char* error_message);

int nexterm_cp_send_port_check_result(nexterm_control_plane_t* cp,
                                       const char* request_id,
                                       const char** ids,
                                       const bool* online,
                                       size_t count);

#endif
