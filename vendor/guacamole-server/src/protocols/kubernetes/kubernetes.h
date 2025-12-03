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

#ifndef GUAC_KUBERNETES_H
#define GUAC_KUBERNETES_H

#include "common/clipboard.h"
#include "io.h"
#include "settings.h"
#include "terminal/terminal.h"

#include <guacamole/client.h>
#include <guacamole/recording.h>
#include <libwebsockets.h>

#include <pthread.h>

/**
 * The name of the WebSocket protocol specific to Kubernetes which should be
 * sent to the Kubernetes server when attaching to a pod.
 */
#define GUAC_KUBERNETES_LWS_PROTOCOL "v4.channel.k8s.io"

/**
 * The maximum number of messages to allow within the outbound message buffer.
 * If messages are sent despite the buffer being full, those messages will be
 * dropped.
 */
#define GUAC_KUBERNETES_MAX_OUTBOUND_MESSAGES 8

/**
 * The maximum number of milliseconds to wait for a libwebsockets event to
 * occur before entering another iteration of the libwebsockets event loop.
 */
#define GUAC_KUBERNETES_SERVICE_INTERVAL 1000

/**
 * Kubernetes-specific client data.
 */
typedef struct guac_kubernetes_client {

    /**
     * Kubernetes connection settings.
     */
    guac_kubernetes_settings* settings;

    /**
     * The libwebsockets context associated with the connected WebSocket.
     */
    struct lws_context* context;

    /**
     * The connected WebSocket.
     */
    struct lws* wsi;

    /**
     * Outbound message ring buffer for outbound WebSocket messages. As
     * libwebsockets uses an event loop for all operations, outbound messages
     * may be sent only in context of a particular event received via a
     * callback. Until that event is received, pending data must accumulate in
     * a buffer.
     */
    guac_kubernetes_message outbound_messages[GUAC_KUBERNETES_MAX_OUTBOUND_MESSAGES];

    /**
     * The number of messages currently waiting in the outbound message
     * buffer.
     */
    int outbound_messages_waiting;

    /**
     * The index of the oldest entry in the outbound message buffer. Newer
     * messages follow this entry.
     */
    int outbound_messages_top;

    /**
     * Lock which is acquired when the outbound message buffer is being read
     * or manipulated.
     */
    pthread_mutex_t outbound_message_lock;

    /**
     * The Kubernetes client thread.
     */
    pthread_t client_thread;

    /**
     * The terminal which will render all output from the Kubernetes pod.
     */
    guac_terminal* term;

    /**
     * The number of rows last sent to Kubernetes in a terminal resize
     * request.
     */
    int rows;

    /**
     * The number of columns last sent to Kubernetes in a terminal resize
     * request.
     */
    int columns;

    /**
     * The in-progress session recording, or NULL if no recording is in
     * progress.
     */
    guac_recording* recording;

} guac_kubernetes_client;

/**
 * Main Kubernetes client thread, handling transfer of STDOUT/STDERR of an
 * attached Kubernetes pod to STDOUT of the terminal.
 */
void* guac_kubernetes_client_thread(void* data);

/**
 * Sends a message to the Kubernetes server requesting that the terminal be
 * resized to the given dimensions. This message may be queued until the
 * underlying WebSocket connection is ready to send.
 *
 * @param client
 *     The guac_client associated with the Kubernetes connection.
 *
 * @param rows
 *     The new terminal size in rows.
 *
 * @param columns
 *     The new terminal size in columns.
 */
void guac_kubernetes_resize(guac_client* client, int rows, int columns);

/**
 * Sends messages to the Kubernetes server such that the terminal is forced
 * to redraw. This function should be invoked at the beginning of each
 * session in order to restore expected display state.
 *
 * @param client
 *     The guac_client associated with the Kubernetes connection.
 */
void guac_kubernetes_force_redraw(guac_client* client);

#endif

