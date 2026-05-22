#ifndef NEXTERM_WEBSOCKET_H
#define NEXTERM_WEBSOCKET_H

#include "session.h"

struct nexterm_control_plane;

int nexterm_websocket_start(nexterm_session_t* session,
                            struct nexterm_control_plane* cp);

#endif
