#ifndef NEXTERM_CONNECTION_H
#define NEXTERM_CONNECTION_H

#include "session.h"

struct nexterm_control_plane;

int nexterm_connection_start_guac(nexterm_session_t* session,
                                  struct nexterm_control_plane* cp);

int nexterm_connection_start_ssh(nexterm_session_t* session,
                                 struct nexterm_control_plane* cp);

int nexterm_connection_start_telnet(nexterm_session_t* session,
                                    struct nexterm_control_plane* cp);

void nexterm_connection_close(nexterm_session_t* session);

int nexterm_connection_join_guac(nexterm_session_t* session,
                                 struct nexterm_control_plane* cp);

#endif
