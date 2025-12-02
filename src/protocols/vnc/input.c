/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include "config.h"

#include "display.h"
#include "vnc.h"

#include <guacamole/display.h>
#include <guacamole/recording.h>
#include <guacamole/user.h>
#include <rfb/rfbclient.h>

int guac_vnc_user_mouse_handler(guac_user* user, int x, int y, int mask) {

    guac_client* client = user->client;
    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    rfbClient* rfb_client = vnc_client->rfb_client;

    /* Store current mouse location/state */
    guac_display_render_thread_notify_user_moved_mouse(vnc_client->render_thread, user, x, y, mask);

    /* Report mouse position within recording */
    if (vnc_client->recording != NULL)
        guac_recording_report_mouse(vnc_client->recording, x, y, mask);

    /* Send VNC event only if finished connecting */
    if (rfb_client != NULL)
        SendPointerEvent(rfb_client, x, y, mask);

    return 0;
}

int guac_vnc_user_key_handler(guac_user* user, int keysym, int pressed) {

    guac_vnc_client* vnc_client = (guac_vnc_client*) user->client->data;
    rfbClient* rfb_client = vnc_client->rfb_client;

    /* Report key state within recording */
    if (vnc_client->recording != NULL)
        guac_recording_report_key(vnc_client->recording,
                keysym, pressed);

    /* Send VNC event only if finished connecting */
    if (rfb_client != NULL)
        SendKeyEvent(rfb_client, keysym, pressed);

    return 0;
}

#ifdef LIBVNC_HAS_RESIZE_SUPPORT
int guac_vnc_user_size_handler(guac_user* user, int width, int height) {

    guac_user_log(user, GUAC_LOG_TRACE, "Running user size handler.");

    /* Get the Guacamole VNC client */
    guac_vnc_client* vnc_client = (guac_vnc_client*) user->client->data;

    /* Send display update */
    guac_vnc_display_set_size(vnc_client->rfb_client, width, height);

    return 0;

}
#endif // LIBVNC_HAS_RESIZE_SUPPORT
