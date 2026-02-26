#ifndef NEXTERM_SESSION_H
#define NEXTERM_SESSION_H

#include <stdint.h>
#include <stdbool.h>
#include <pthread.h>

#define MAX_SESSION_ID_LEN 64
#define MAX_SESSIONS 256
#define MAX_PARAMS 64

typedef enum {
    SESSION_TYPE_VNC,
    SESSION_TYPE_RDP,
    SESSION_TYPE_SSH,
    SESSION_TYPE_SFTP,
    SESSION_TYPE_TELNET,
    SESSION_TYPE_TUNNEL,
} session_type_t;

typedef enum {
    SESSION_STATE_PENDING,
    SESSION_STATE_CONNECTING,
    SESSION_STATE_ACTIVE,
    SESSION_STATE_CLOSING,
    SESSION_STATE_CLOSED,
} session_state_t;

typedef struct {
    char key[64];
    char* value;
} session_param_t;

typedef struct nexterm_session {
    char session_id[MAX_SESSION_ID_LEN];
    session_type_t type;
    volatile session_state_t state;

    char host[256];
    uint16_t port;

    session_param_t params[MAX_PARAMS];
    int param_count;

    char guac_connection_id[64];

    int data_fd;
    int join_pipe[2];

    void* guac_client;

    void* ssh_session;
    void* ssh_channel;
    int ssh_sock;

    int telnet_sock;

    pthread_t thread;
    bool thread_active;
} nexterm_session_t;

typedef struct {
    nexterm_session_t sessions[MAX_SESSIONS];
    int count;
    pthread_mutex_t mutex;
} nexterm_session_manager_t;

void nexterm_sm_init(nexterm_session_manager_t* sm);

nexterm_session_t* nexterm_sm_create(nexterm_session_manager_t* sm,
                                     const char* session_id,
                                     session_type_t type,
                                     const char* host,
                                     uint16_t port);

nexterm_session_t* nexterm_sm_find(nexterm_session_manager_t* sm,
                                   const char* session_id);

void nexterm_sm_remove(nexterm_session_manager_t* sm,
                       const char* session_id);

const char* nexterm_session_get_param(const nexterm_session_t* session,
                                      const char* key);

int nexterm_session_add_param(nexterm_session_t* session,
                              const char* key,
                              const char* value);

void nexterm_sm_destroy(nexterm_session_manager_t* sm);

#endif
