#ifndef NEXTERM_FTP_H
#define NEXTERM_FTP_H

#include "session.h"

struct nexterm_control_plane;

bool nexterm_ftp_is_ftp_session(const nexterm_session_t* session);

int nexterm_ftp_start(nexterm_session_t* session,
                      struct nexterm_control_plane* cp);

#endif
