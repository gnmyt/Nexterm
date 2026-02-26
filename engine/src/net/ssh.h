#ifndef NEXTERM_SSH_H
#define NEXTERM_SSH_H

#include "session.h"

struct nexterm_control_plane;

typedef struct {
    const char* username;
    const char* password;
    const char* private_key;
    const char* passphrase;
} ssh_credentials_t;

int nexterm_ssh_start(nexterm_session_t* session,
                      struct nexterm_control_plane* cp);

void nexterm_ssh_resize(nexterm_session_t* session,
                        uint16_t cols, uint16_t rows);

int nexterm_tunnel_start(nexterm_session_t* session,
                         struct nexterm_control_plane* cp);

int nexterm_ssh_exec_command(struct nexterm_control_plane* cp,
                             const char* request_id,
                             const char* host, uint16_t port,
                             const ssh_credentials_t* creds,
                             const char* command);

#endif
