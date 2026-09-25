#ifndef NEXTERM_WEB_H
#define NEXTERM_WEB_H

#include "session.h"

#include <guacamole/client.h>
#include <guacamole/user.h>

struct nexterm_control_plane;

int nexterm_web_prepare(nexterm_session_t* session,
                        struct nexterm_control_plane* cp,
                        uint16_t* out_vnc_port);

void nexterm_web_teardown(nexterm_session_t* session);

void nexterm_web_attach_client(nexterm_session_t* session, guac_client* client);

int nexterm_web_pipe_handler(guac_user* user, guac_stream* stream,
                             char* mimetype, char* name);

#endif
