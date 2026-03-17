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

#include "channels/audio-input/audio-buffer.h"
#include "channels/audio-input/audio-input.h"
#include "plugins/channels.h"
#include "plugins/ptr-string.h"
#include "rdp.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <errno.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/**
 * Parses the given raw audio mimetype, producing the corresponding rate,
 * number of channels, and bytes per sample.
 *
 * @param mimetype
 *     The raw audio mimetype to parse.
 *
 * @param rate
 *     A pointer to an int where the sample rate for the PCM format described
 *     by the given mimetype should be stored.
 *
 * @param channels
 *     A pointer to an int where the number of channels used by the PCM format
 *     described by the given mimetype should be stored.
 *
 * @param bps
 *     A pointer to an int where the number of bytes used the PCM format for
 *     each sample (independent of number of channels) described by the given
 *     mimetype should be stored.
 *
 * @return
 *     Zero if the given mimetype is a raw audio mimetype and has been parsed
 *     successfully, non-zero otherwise.
 */
static int guac_rdp_audio_parse_mimetype(const char* mimetype,
        int* rate, int* channels, int* bps) {

    int parsed_rate = -1;
    int parsed_channels = 1;
    int parsed_bps;

    /* PCM audio with one byte per sample */
    if (strncmp(mimetype, "audio/L8;", 9) == 0) {
        mimetype += 8; /* Advance to semicolon ONLY */
        parsed_bps = 1;
    }

    /* PCM audio with two bytes per sample */
    else if (strncmp(mimetype, "audio/L16;", 10) == 0) {
        mimetype += 9; /* Advance to semicolon ONLY */
        parsed_bps = 2;
    }

    /* Unsupported mimetype */
    else
        return 1;

    /* Parse each parameter name/value pair within the mimetype */
    do {

        /* Advance to first character of parameter (current is either a
         * semicolon or a comma) */
        mimetype++;

        /* Parse number of channels */
        if (strncmp(mimetype, "channels=", 9) == 0) {

            mimetype += 9;
            parsed_channels = strtol(mimetype, (char**) &mimetype, 10);

            /* Fail if value invalid / out of range */
            if (errno == EINVAL || errno == ERANGE)
                return 1;

        }

        /* Parse number of rate */
        else if (strncmp(mimetype, "rate=", 5) == 0) {

            mimetype += 5;
            parsed_rate = strtol(mimetype, (char**) &mimetype, 10);

            /* Fail if value invalid / out of range */
            if (errno == EINVAL || errno == ERANGE)
                return 1;

        }

        /* Advance to next parameter */
        mimetype = strchr(mimetype, ',');

    } while (mimetype != NULL);

    /* Mimetype is invalid if rate was not specified */
    if (parsed_rate == -1)
        return 1;

    /* Parse success */
    *rate = parsed_rate;
    *channels = parsed_channels;
    *bps = parsed_bps;

    return 0;

}

int guac_rdp_audio_handler(guac_user* user, guac_stream* stream,
        char* mimetype) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    int rate;
    int channels;
    int bps;

    /* Parse mimetype, abort on parse error */
    if (guac_rdp_audio_parse_mimetype(mimetype, &rate, &channels, &bps)) {
        guac_user_log(user, GUAC_LOG_WARNING, "Denying user audio stream with "
                "unsupported mimetype: \"%s\"", mimetype);
        guac_protocol_send_ack(user->socket, stream, "Unsupported audio "
                "mimetype", GUAC_PROTOCOL_STATUS_CLIENT_BAD_TYPE);
        return 0;
    }

    /* Init stream data */
    stream->blob_handler = guac_rdp_audio_blob_handler;
    stream->end_handler = guac_rdp_audio_end_handler;

    /* Associate stream with audio buffer */
    guac_rdp_audio_buffer_set_stream(rdp_client->audio_input, user, stream,
            rate, channels, bps);

    return 0;

}

int guac_rdp_audio_blob_handler(guac_user* user, guac_stream* stream,
        void* data, int length) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Write blob to audio stream, buffering if necessary */
    guac_rdp_audio_buffer_write(rdp_client->audio_input, data, length);

    return 0;

}

int guac_rdp_audio_end_handler(guac_user* user, guac_stream* stream) {

    /* Ignore - the AUDIO_INPUT channel will simply not receive anything */
    return 0;

}

void guac_rdp_audio_load_plugin(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    char client_ref[GUAC_RDP_PTR_STRING_LENGTH];

    /* Add "AUDIO_INPUT" channel */
    guac_rdp_ptr_to_string(client, client_ref);
    guac_freerdp_dynamic_channel_collection_add(context->settings, "guacai", client_ref, NULL);

}

