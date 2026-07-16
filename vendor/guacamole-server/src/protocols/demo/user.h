#ifndef GUAC_DEMO_USER_H
#define GUAC_DEMO_USER_H

#include <guacamole/user.h>

extern const char* GUAC_DEMO_CLIENT_ARGS[];

guac_user_join_handler guac_demo_user_join_handler;

guac_user_leave_handler guac_demo_user_leave_handler;

#endif
