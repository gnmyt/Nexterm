#ifndef NEXTERM_TELNET_H
#define NEXTERM_TELNET_H

#include "session.h"

struct nexterm_control_plane;

int nexterm_telnet_start(nexterm_session_t* session,
                         struct nexterm_control_plane* cp);

void nexterm_telnet_resize(nexterm_session_t* session,
                           uint16_t cols, uint16_t rows);

#endif
