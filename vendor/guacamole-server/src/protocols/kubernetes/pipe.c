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

#include "kubernetes.h"
#include "terminal/terminal.h"
#include "pipe.h"

#include <guacamole/client.h>
#include <guacamole/protocol.h>
#include <guacamole/stream-types.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

#include <string.h>

int guac_kubernetes_pipe_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* name) {

    guac_client* client = user->client;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Redirect STDIN if pipe has required name */
    if (strcmp(name, GUAC_KUBERNETES_STDIN_PIPE_NAME) == 0) {
        guac_terminal_send_stream(kubernetes_client->term, user, stream);
        return 0;
    }

    /* No other inbound pipe streams are supported */
    guac_protocol_send_ack(user->socket, stream, "No such input stream.",
            GUAC_PROTOCOL_STATUS_RESOURCE_NOT_FOUND);
    guac_socket_flush(user->socket);
    return 0;

}

