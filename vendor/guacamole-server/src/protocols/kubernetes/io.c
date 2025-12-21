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

#include <guacamole/client.h>
#include <libwebsockets.h>

#include <pthread.h>
#include <stdbool.h>
#include <string.h>

void guac_kubernetes_receive_data(guac_client* client,
        const char* buffer, size_t length) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Strip channel index from beginning of buffer */
    int channel = *(buffer++);
    length--;

    switch (channel) {

        /* Write STDOUT / STDERR directly to terminal as output */
        case GUAC_KUBERNETES_CHANNEL_STDOUT:
        case GUAC_KUBERNETES_CHANNEL_STDERR:
            guac_terminal_write(kubernetes_client->term, buffer, length);
            break;

        /* Ignore data on other channels */
        default:
            guac_client_log(client, GUAC_LOG_DEBUG, "Received %i bytes along "
                    "channel %i.", length, channel);

    }

}

void guac_kubernetes_send_message(guac_client* client,
        int channel, const char* data, int length) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    pthread_mutex_lock(&(kubernetes_client->outbound_message_lock));

    /* Add message to buffer if space is available */
    if (kubernetes_client->outbound_messages_waiting
            < GUAC_KUBERNETES_MAX_OUTBOUND_MESSAGES) {

        /* Calculate storage position of next message */
        int index = (kubernetes_client->outbound_messages_top
                  + kubernetes_client->outbound_messages_waiting)
                  % GUAC_KUBERNETES_MAX_OUTBOUND_MESSAGES;

        /* Obtain pointer to message slot at calculated position */
        guac_kubernetes_message* message =
            &(kubernetes_client->outbound_messages[index]);

        /* Copy details of message into buffer */
        message->channel = channel;
        memcpy(message->data, data, length);
        message->length = length;

        /* One more message is now waiting */
        kubernetes_client->outbound_messages_waiting++;

        /* Notify libwebsockets that we need a callback to send pending
         * messages */
        lws_callback_on_writable(kubernetes_client->wsi);
        lws_cancel_service(kubernetes_client->context);

    }

    /* Warn if data has to be dropped */
    else
        guac_client_log(client, GUAC_LOG_WARNING, "Send buffer could not be "
                "flushed in time to handle additional data. Outbound "
                "message dropped.");

    pthread_mutex_unlock(&(kubernetes_client->outbound_message_lock));

}

bool guac_kubernetes_write_pending_message(guac_client* client) {

    bool messages_remain;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    pthread_mutex_lock(&(kubernetes_client->outbound_message_lock));

    /* Send one message from top of buffer */
    if (kubernetes_client->outbound_messages_waiting > 0) {

        /* Obtain pointer to message at top */
        int top = kubernetes_client->outbound_messages_top;
        guac_kubernetes_message* message =
            &(kubernetes_client->outbound_messages[top]);

        /* Write message including channel index */
        lws_write(kubernetes_client->wsi,
                ((unsigned char*) message) + LWS_PRE,
                message->length + 1, LWS_WRITE_BINARY);

        /* Advance top to next message */
        kubernetes_client->outbound_messages_top++;
        kubernetes_client->outbound_messages_top %=
            GUAC_KUBERNETES_MAX_OUTBOUND_MESSAGES;

        /* One less message is waiting */
        kubernetes_client->outbound_messages_waiting--;

    }

    /* Record whether messages remained at time of completion */
    messages_remain = (kubernetes_client->outbound_messages_waiting > 0);

    pthread_mutex_unlock(&(kubernetes_client->outbound_message_lock));

    return messages_remain;

}

