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

#include "input.h"
#include "kubernetes.h"
#include "terminal/terminal.h"

#include <guacamole/client.h>
#include <guacamole/recording.h>
#include <guacamole/user.h>

#include <stdlib.h>

int guac_kubernetes_user_mouse_handler(guac_user* user,
        int x, int y, int mask) {

    guac_client* client = user->client;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Skip if terminal not yet ready */
    guac_terminal* term = kubernetes_client->term;
    if (term == NULL)
        return 0;

    /* Report mouse position within recording */
    if (kubernetes_client->recording != NULL)
        guac_recording_report_mouse(kubernetes_client->recording, x, y,
                mask);

    guac_terminal_send_mouse(term, user, x, y, mask);
    return 0;

}

int guac_kubernetes_user_key_handler(guac_user* user, int keysym, int pressed) {

    guac_client* client = user->client;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Report key state within recording */
    if (kubernetes_client->recording != NULL)
        guac_recording_report_key(kubernetes_client->recording,
                keysym, pressed);

    /* Skip if terminal not yet ready */
    guac_terminal* term = kubernetes_client->term;
    if (term == NULL)
        return 0;

    guac_terminal_send_key(term, keysym, pressed);
    return 0;

}

int guac_kubernetes_user_size_handler(guac_user* user, int width, int height) {

    /* Get terminal */
    guac_client* client = user->client;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Skip if terminal not yet ready */
    guac_terminal* terminal = kubernetes_client->term;
    if (terminal == NULL)
        return 0;

    /* Resize terminal */
    guac_terminal_resize(terminal, width, height);

    /* Update Kubernetes terminal window size if connected */
    guac_kubernetes_resize(client,
            guac_terminal_get_rows(terminal),
            guac_terminal_get_columns(terminal));

    return 0;
}

