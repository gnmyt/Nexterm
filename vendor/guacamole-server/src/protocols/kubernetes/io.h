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

#ifndef GUAC_KUBERNETES_IO_H
#define GUAC_KUBERNETES_IO_H

#include <guacamole/client.h>
#include <libwebsockets.h>

#include <stdbool.h>
#include <stdint.h>

/**
 * The maximum amount of data to include in any particular WebSocket message
 * to Kubernetes. This excludes the storage space required for the channel
 * index.
 */
#define GUAC_KUBERNETES_MAX_MESSAGE_SIZE 1024

/**
 * The index of the Kubernetes channel used for STDIN.
 */
#define GUAC_KUBERNETES_CHANNEL_STDIN 0

/**
 * The index of the Kubernetes channel used for STDOUT.
 */
#define GUAC_KUBERNETES_CHANNEL_STDOUT 1

/**
 * The index of the Kubernetes channel used for STDERR.
 */
#define GUAC_KUBERNETES_CHANNEL_STDERR 2

/**
 * The index of the Kubernetes channel used for terminal resize messages.
 */
#define GUAC_KUBERNETES_CHANNEL_RESIZE 4

/**
 * An outbound message to be received by Kubernetes over WebSocket.
 */
typedef struct guac_kubernetes_message {

    /**
     * lws_write() requires leading padding of LWS_PRE bytes to provide
     * scratch space for WebSocket framing.
     */
    uint8_t _padding[LWS_PRE];

    /**
     * The index of the channel receiving the data, such as
     * GUAC_KUBERNETES_CHANNEL_STDIN.
     */
    uint8_t channel;

    /**
     * The data that should be sent to Kubernetes (along with the channel
     * index).
     */
    char data[GUAC_KUBERNETES_MAX_MESSAGE_SIZE];

    /**
     * The length of the data to be sent, excluding the channel index.
     */
    int length;

} guac_kubernetes_message;

/**
 * Handles data received from Kubernetes over WebSocket, decoding the channel
 * index of the received data and forwarding that data accordingly.
 *
 * @param client
 *     The guac_client associated with the connection to Kubernetes.
 *
 * @param buffer
 *     The data received from Kubernetes.
 *
 * @param length
 *     The size of the data received from Kubernetes, in bytes.
 */
void guac_kubernetes_receive_data(guac_client* client,
        const char* buffer, size_t length);

/**
 * Requests that the given data be sent along the given channel to the
 * Kubernetes server when the WebSocket connection is next available for
 * writing. If the WebSocket connection has not been available for writing for
 * long enough that the outbound message buffer is full, the request to send
 * this particular message will be dropped.
 *
 * @param client
 *     The guac_client associated with the Kubernetes connection.
 *
 * @param channel
 *     The Kubernetes channel on which to send the message,
 *     such as GUAC_KUBERNETES_CHANNEL_STDIN.
 *
 * @param data
 *     A buffer containing the data to send.
 *
 * @param length
 *     The number of bytes to send.
 */
void guac_kubernetes_send_message(guac_client* client,
        int channel, const char* data, int length);

/**
 * Writes the oldest pending message within the outbound message queue,
 * as scheduled with guac_kubernetes_send_message(), removing that message
 * from the queue. This function MAY NOT be invoked outside the libwebsockets
 * event callback and MUST only be invoked in the context of a
 * LWS_CALLBACK_CLIENT_WRITEABLE event. If no messages are pending, this
 * function has no effect.
 *
 * @param client
 *     The guac_client associated with the Kubernetes connection.
 *
 * @return
 *     true if messages still remain to be written within the outbound message
 *     queue, false otherwise.
 */
bool guac_kubernetes_write_pending_message(guac_client* client);

#endif

