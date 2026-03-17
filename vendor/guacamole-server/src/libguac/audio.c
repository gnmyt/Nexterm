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

#include "guacamole/mem.h"
#include "guacamole/audio.h"
#include "guacamole/client.h"
#include "guacamole/protocol.h"
#include "guacamole/stream.h"
#include "guacamole/user.h"
#include "raw_encoder.h"

#include <stdlib.h>
#include <string.h>

/**
 * Sets the encoder associated with the given guac_audio_stream, automatically
 * invoking its begin_handler. The guac_audio_stream MUST NOT already be
 * associated with an encoder.
 *
 * @param audio
 *     The guac_audio_stream whose encoder is being set.
 *
 * @param encoder
 *     The encoder to associate with the given guac_audio_stream.
 */
static void guac_audio_stream_set_encoder(guac_audio_stream* audio,
        guac_audio_encoder* encoder) {

    /* Call handler, if defined */
    if (encoder != NULL && encoder->begin_handler)
        encoder->begin_handler(audio);

    /* Assign encoder, which may be NULL */
    audio->encoder = encoder;

}

/**
 * Assigns a new audio encoder to the given guac_audio_stream based on the
 * audio mimetypes declared as supported by the given user. If no audio encoder
 * can be found, no new audio encoder is assigned, and the existing encoder is
 * left untouched (if any).
 *
 * @param user
 *     The user whose supported audio mimetypes should determine the audio
 *     encoder selected.
 *
 * @param data
 *     The guac_audio_stream to which the new encoder should be assigned.
 *     Existing properties set on this audio stream, such as the bits per
 *     sample, may affect the encoder chosen.
 *
 * @return
 *     The assigned audio encoder. If no new audio encoder can be assigned,
 *     this will be the currently-assigned audio encoder (which may be NULL).
 */
static void* guac_audio_assign_encoder(guac_user* user, void* data) {

    int i;

    guac_audio_stream* audio = (guac_audio_stream*) data;
    int bps = audio->bps;

    /* If no user is provided, or an encoder has already been assigned,
     * do not attempt to assign a new encoder */
    if (user == NULL || audio->encoder != NULL)
        return audio->encoder;

    /* For each supported mimetype, check for an associated encoder */
    for (i=0; user->info.audio_mimetypes[i] != NULL; i++) {

        const char* mimetype = user->info.audio_mimetypes[i];

        /* If 16-bit raw audio is supported, done. */
        if (bps == 16 && strcmp(mimetype, raw16_encoder->mimetype) == 0) {
            guac_audio_stream_set_encoder(audio, raw16_encoder);
            break;
        }

        /* If 8-bit raw audio is supported, done. */
        if (bps == 8 && strcmp(mimetype, raw8_encoder->mimetype) == 0) {
            guac_audio_stream_set_encoder(audio, raw8_encoder);
            break;
        }

    } /* end for each mimetype */

    /* Return assigned encoder, if any */
    return audio->encoder;

}

guac_audio_stream* guac_audio_stream_alloc(guac_client* client,
        guac_audio_encoder* encoder, int rate, int channels, int bps) {

    guac_audio_stream* audio;

    /* Allocate stream */
    audio = (guac_audio_stream*) guac_mem_zalloc(sizeof(guac_audio_stream));
    audio->client = client;
    audio->stream = guac_client_alloc_stream(client);

    /* Abort allocation if underlying stream cannot be allocated */
    if (audio->stream == NULL) {
        guac_mem_free(audio);
        return NULL;
    }

    /* Load PCM properties */
    audio->rate = rate;
    audio->channels = channels;
    audio->bps = bps;

    /* Assign encoder if explicitly provided */
    if (encoder != NULL)
        guac_audio_stream_set_encoder(audio, encoder);

    /* Otherwise, attempt to automatically assign encoder for owner */
    if (audio->encoder == NULL)
        guac_client_for_owner(client, guac_audio_assign_encoder, audio);

    /* Failing that, attempt to assign encoder for ANY connected user */
    if (audio->encoder == NULL)
        guac_client_foreach_user(client, guac_audio_assign_encoder, audio);

    return audio;

}

void guac_audio_stream_reset(guac_audio_stream* audio,
        guac_audio_encoder* encoder, int rate, int channels, int bps) {

    /* Pull assigned encoder if no other encoder is requested */
    if (encoder == NULL)
        encoder = audio->encoder;

    /* Do nothing if nothing is changing */
    if (encoder == audio->encoder
            && rate     == audio->rate
            && channels == audio->channels
            && bps      == audio->bps) {
        return;
    }

    /* Free old encoder data */
    if (audio->encoder != NULL && audio->encoder->end_handler)
        audio->encoder->end_handler(audio);

    /* Set PCM properties */
    audio->rate = rate;
    audio->channels = channels;
    audio->bps = bps;

    /* Re-init encoder */
    guac_audio_stream_set_encoder(audio, encoder);

}

void guac_audio_stream_add_user(guac_audio_stream* audio, guac_user* user) {

    /* Attempt to assign encoder if no encoder has yet been assigned */
    if (audio->encoder == NULL)
        guac_audio_assign_encoder(user, audio);

    /* Notify encoder that a new user is present */
    if (audio->encoder != NULL && audio->encoder->join_handler)
        audio->encoder->join_handler(audio, user);

}

void guac_audio_stream_free(guac_audio_stream* audio) {

    /* Flush stream encoding */
    guac_audio_stream_flush(audio);

    /* Clean up encoder */
    if (audio->encoder != NULL && audio->encoder->end_handler)
        audio->encoder->end_handler(audio);

    /* Release stream back to client pool */
    guac_client_free_stream(audio->client, audio->stream);

    /* Free associated data */
    guac_mem_free(audio);

}

void guac_audio_stream_write_pcm(guac_audio_stream* audio, 
        const unsigned char* data, int length) {

    /* Write data */
    if (audio->encoder != NULL && audio->encoder->write_handler)
        audio->encoder->write_handler(audio, data, length);

}

void guac_audio_stream_flush(guac_audio_stream* audio) {

    /* Flush any buffered data */
    if (audio->encoder != NULL && audio->encoder->flush_handler)
        audio->encoder->flush_handler(audio);

}

