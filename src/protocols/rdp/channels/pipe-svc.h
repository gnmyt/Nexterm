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

#ifndef GUAC_RDP_CHANNELS_PIPE_SVC_H
#define GUAC_RDP_CHANNELS_PIPE_SVC_H

#include "channels/common-svc.h"

#include <freerdp/freerdp.h>
#include <freerdp/svc.h>
#include <guacamole/client.h>
#include <guacamole/stream.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>
#include <winpr/wtsapi.h>

/**
 * The maximum number of bytes to allow within each channel name, including
 * null terminator.
 */
#define GUAC_RDP_SVC_MAX_LENGTH 8

/**
 * Structure describing a static virtual channel and a corresponding Guacamole
 * pipe stream;
 */
typedef struct guac_rdp_pipe_svc {

    /**
     * The output pipe, opened when the RDP server receives a connection to
     * the static channel.
     */
    guac_stream* output_pipe;

    /**
     * The underlying static channel. Data written to this SVC by the RDP
     * server will be forwarded along the pipe stream to the Guacamole client,
     * and data written to the pipe stream by the Guacamole client will be
     * forwarded along the SVC to the RDP server.
     */
    guac_rdp_common_svc* svc;

} guac_rdp_pipe_svc;

/**
 * Initializes arbitrary static virtual channel (SVC) support for RDP, handling
 * communication for the SVC having the given name. Data sent from within the
 * RDP session using this channel will be sent along an identically-named pipe
 * stream to the Guacamole client, and data sent along a pipe stream having the
 * same name will be written to the SVC and received within the RDP session. If
 * failures occur while loading the plugin, messages noting the specifics of
 * those failures will be logged, and support for the given channel will not be
 * functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for static virtual channel support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the FreeRDP side of the RDP connection.
 *
 * @param name
 *     The name of the SVC which should be handled.
 */
void guac_rdp_pipe_svc_load_plugin(rdpContext* context, char* name);

/**
 * Sends the "pipe" instruction describing the given static virtual channel
 * along the given socket. This pipe instruction will relate the SVC's
 * underlying output stream with the SVC's name and the mimetype
 * "application/octet-stream".
 *
 * @param socket
 *     The socket along which the "pipe" instruction should be sent.
 *
 * @param svc
 *     The static virtual channel that the "pipe" instruction should describe.
 */
void guac_rdp_pipe_svc_send_pipe(guac_socket* socket, guac_rdp_pipe_svc* svc);

/**
 * Sends the "pipe" instructions describing all static virtual channels
 * available to the all users associated with the provided socket. Each pipe
 * instruction will relate the associated SVC's underlying output stream with
 * the SVC's name and the mimetype "application/octet-stream".
 *
 * @param client
 *     The client associated with the users being sent the pipe instruction.
 *
 * @param socket
 *     The socket to send the pipe instruction across.
 */
void guac_rdp_pipe_svc_send_pipes(
        guac_client* client, guac_socket* socket);

/**
 * Add the given SVC to the list of all available SVCs. This function must be
 * invoked after the SVC is connected for inbound pipe streams having that
 * SVC's name to result in received data being sent into the RDP session.
 *
 * @param client
 *     The guac_client associated with the current RDP session.
 *
 * @param svc
 *     The static virtual channel to add to the list of all such channels
 *     available.
 */
void guac_rdp_pipe_svc_add(guac_client* client, guac_rdp_pipe_svc* svc);

/**
 * Retrieve the SVC with the given name from the list stored in the client. The
 * requested SVC must previously have been added using guac_rdp_pipe_svc_add().
 *
 * @param client
 *     The guac_client associated with the current RDP session.
 *
 * @param name
 *     The name of the static virtual channel to retrieve.
 *
 * @return
 *     The static virtual channel with the given name, or NULL if no such
 *     virtual channel exists.
 */
guac_rdp_pipe_svc* guac_rdp_pipe_svc_get(guac_client* client, const char* name);

/**
 * Removes the SVC with the given name from the list stored in the client.
 * Inbound pipe streams having the given name will no longer be routed to the
 * associated SVC.
 *
 * @param client
 *     The guac_client associated with the current RDP session.
 *
 * @param name
 *     The name of the static virtual channel to remove.
 *
 * @return
 *     The static virtual channel that was removed, or NULL if no such virtual
 *     channel exists.
 */
guac_rdp_pipe_svc* guac_rdp_pipe_svc_remove(guac_client* client, const char* name);

/**
 * Handler for "blob" instructions which writes received data to the associated
 * SVC using guac_rdp_pipe_svc_write().
 */
guac_user_blob_handler guac_rdp_pipe_svc_blob_handler;

/**
 * Handler for "pipe" instructions which prepares received pipe streams to
 * write received blobs to the SVC having the same name as the pipe stream.
 * Received pipe streams are associated with the relevant guac_rdp_pipe_svc
 * instance and the SVC-specific "blob" instruction handler
 * (guac_rdp_pipe_svc_blob_handler).
 */
guac_user_pipe_handler guac_rdp_pipe_svc_pipe_handler;

/**
 * Handler which is invoked when an SVC associated with a Guacamole pipe stream
 * is connected to the RDP server.
 */
guac_rdp_common_svc_connect_handler guac_rdp_pipe_svc_process_connect;

/**
 * Handler which is invoked when an SVC associated with a Guacamole pipe stream
 * received data from the RDP server.
 */
guac_rdp_common_svc_receive_handler guac_rdp_pipe_svc_process_receive;

/**
 * Handler which is invoked when an SVC associated with a Guacamole pipe stream
 * has disconnected and is about to be freed.
 */
guac_rdp_common_svc_terminate_handler guac_rdp_pipe_svc_process_terminate;

#endif

