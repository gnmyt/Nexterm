#ifndef NEXTERM_SFTP_H
#define NEXTERM_SFTP_H

#include "session.h"

struct nexterm_control_plane;

int nexterm_sftp_start(nexterm_session_t* session,
                       struct nexterm_control_plane* cp);

#endif
