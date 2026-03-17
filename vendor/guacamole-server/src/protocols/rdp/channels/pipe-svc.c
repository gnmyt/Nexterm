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

#include "channels/common-svc.h"
#include "channels/pipe-svc.h"
#include "common/list.h"
#include "rdp.h"

#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>
#include <winpr/stream.h>

#include <stdlib.h>
#include <string.h>

void guac_rdp_pipe_svc_send_pipe(guac_socket* socket, guac_rdp_pipe_svc* pipe_svc) {

    /* Send pipe instruction for the SVC's output stream */
    guac_protocol_send_pipe(socket, pipe_svc->output_pipe,
            "application/octet-stream", pipe_svc->svc->name);

}

void guac_rdp_pipe_svc_send_pipes(
        guac_client* client, guac_socket* socket) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    if (rdp_client->available_svc != NULL) {
        guac_common_list_lock(rdp_client->available_svc);

        /* Send pipe for each allocated SVC's output stream */
        guac_common_list_element* current = rdp_client->available_svc->head;
        while (current != NULL) {
            guac_rdp_pipe_svc_send_pipe(socket, (guac_rdp_pipe_svc*) current->data);
            current = current->next;
        }

        guac_common_list_unlock(rdp_client->available_svc);
    }
}

void guac_rdp_pipe_svc_add(guac_client* client, guac_rdp_pipe_svc* pipe_svc) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Add to list of available SVC */
    guac_common_list_lock(rdp_client->available_svc);
    guac_common_list_add(rdp_client->available_svc, pipe_svc);
    guac_common_list_unlock(rdp_client->available_svc);

}

guac_rdp_pipe_svc* guac_rdp_pipe_svc_get(guac_client* client, const char* name) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_common_list_element* current;
    guac_rdp_pipe_svc* found = NULL;

    /* For each available SVC */
    guac_common_list_lock(rdp_client->available_svc);
    current = rdp_client->available_svc->head;
    while (current != NULL) {

        /* If name matches, found */
        guac_rdp_pipe_svc* current_svc = (guac_rdp_pipe_svc*) current->data;
        if (strcmp(current_svc->svc->name, name) == 0) {
            found = current_svc;
            break;
        }

        current = current->next;

    }
    guac_common_list_unlock(rdp_client->available_svc);

    return found;

}

guac_rdp_pipe_svc* guac_rdp_pipe_svc_remove(guac_client* client, const char* name) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_common_list_element* current;
    guac_rdp_pipe_svc* found = NULL;

    /* For each available SVC */
    guac_common_list_lock(rdp_client->available_svc);
    current = rdp_client->available_svc->head;
    while (current != NULL) {

        /* If name matches, remove entry */
        guac_rdp_pipe_svc* current_svc = (guac_rdp_pipe_svc*) current->data;
        if (strcmp(current_svc->svc->name, name) == 0) {
            guac_common_list_remove(rdp_client->available_svc, current);
            found = current_svc;
            break;
        }

        current = current->next;

    }
    guac_common_list_unlock(rdp_client->available_svc);

    /* Return removed entry, if any */
    return found;

}

int guac_rdp_pipe_svc_pipe_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* name) {

    guac_rdp_pipe_svc* pipe_svc = guac_rdp_pipe_svc_get(user->client, name);

    /* Fail if no such SVC */
    if (pipe_svc == NULL) {
        guac_user_log(user, GUAC_LOG_WARNING, "User requested non-existent "
                "pipe (no such SVC configured): \"%s\"", name);
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO SUCH PIPE)",
                GUAC_PROTOCOL_STATUS_CLIENT_BAD_REQUEST);
        guac_socket_flush(user->socket);
        return 0;
    }
    else
        guac_user_log(user, GUAC_LOG_DEBUG, "Inbound half of channel \"%s\" "
                "connected.", name);

    /* Init stream data */
    stream->data = pipe_svc;
    stream->blob_handler = guac_rdp_pipe_svc_blob_handler;

    return 0;

}

int guac_rdp_pipe_svc_blob_handler(guac_user* user, guac_stream* stream,
        void* data, int length) {

    guac_rdp_pipe_svc* pipe_svc = (guac_rdp_pipe_svc*) stream->data;

    /* Write blob data to SVC directly */
    wStream* output_stream = Stream_New(NULL, length);
    Stream_Write(output_stream, data, length);
    guac_rdp_common_svc_write(pipe_svc->svc, output_stream);

    guac_protocol_send_ack(user->socket, stream, "OK (DATA RECEIVED)",
            GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;

}

void guac_rdp_pipe_svc_process_connect(guac_rdp_common_svc* svc) {

    /* Associate SVC with new Guacamole pipe */
    guac_rdp_pipe_svc* pipe_svc = guac_mem_alloc(sizeof(guac_rdp_pipe_svc));
    pipe_svc->svc = svc;
    pipe_svc->output_pipe = guac_client_alloc_stream(svc->client);
    svc->data = pipe_svc;

    /* SVC may now receive data from client */
    guac_rdp_pipe_svc_add(svc->client, pipe_svc);

    /* Notify of pipe's existence */
    guac_rdp_pipe_svc_send_pipe(svc->client->socket, pipe_svc);

}

void guac_rdp_pipe_svc_process_receive(guac_rdp_common_svc* svc,
        wStream* input_stream) {

    guac_rdp_pipe_svc* pipe_svc = (guac_rdp_pipe_svc*) svc->data;

    /* Fail if output not created */
    if (pipe_svc->output_pipe == NULL) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "%i bytes of data "
                "received from within the remote desktop session for SVC "
                "\"%s\" are being dropped because the outbound pipe stream "
                "for that SVC is not yet open. This should NOT happen.",
                Stream_Length(input_stream), svc->name);
        return;
    }

    /* Send received data as blob */
    guac_protocol_send_blob(svc->client->socket, pipe_svc->output_pipe, Stream_Buffer(input_stream), Stream_Length(input_stream));
    guac_socket_flush(svc->client->socket);

}

void guac_rdp_pipe_svc_process_terminate(guac_rdp_common_svc* svc) {

    guac_rdp_pipe_svc* pipe_svc = (guac_rdp_pipe_svc*) svc->data;
    if (pipe_svc == NULL)
        return;

    /* Remove and free SVC */
    guac_rdp_pipe_svc_remove(svc->client, svc->name);
    guac_mem_free(pipe_svc);

}

void guac_rdp_pipe_svc_load_plugin(rdpContext* context, char* name) {

    /* Attempt to load support for static channel */
    guac_rdp_common_svc_load_plugin(context, name, CHANNEL_OPTION_COMPRESS_RDP,
            guac_rdp_pipe_svc_process_connect,
            guac_rdp_pipe_svc_process_receive,
            guac_rdp_pipe_svc_process_terminate);

}

