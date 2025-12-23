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
#include "guacamole/client.h"
#include "guacamole/object.h"
#include "guacamole/protocol.h"
#include "guacamole/stream.h"
#include "guacamole/string.h"
#include "guacamole/timestamp.h"
#include "guacamole/user.h"
#include "user-handlers.h"

#include <inttypes.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* Guacamole instruction handler map */

__guac_instruction_handler_mapping __guac_instruction_handler_map[] = {
   {"sync",       __guac_handle_sync},
   {"touch",      __guac_handle_touch},
   {"mouse",      __guac_handle_mouse},
   {"key",        __guac_handle_key},
   {"clipboard",  __guac_handle_clipboard},
   {"disconnect", __guac_handle_disconnect},
   {"size",       __guac_handle_size},
   {"file",       __guac_handle_file},
   {"pipe",       __guac_handle_pipe},
   {"ack",        __guac_handle_ack},
   {"blob",       __guac_handle_blob},
   {"end",        __guac_handle_end},
   {"get",        __guac_handle_get},
   {"put",        __guac_handle_put},
   {"audio",      __guac_handle_audio},
   {"argv",       __guac_handle_argv},
   {"nop",        __guac_handle_nop},
   {NULL,         NULL}
};

/* Guacamole handshake handler map */

__guac_instruction_handler_mapping __guac_handshake_handler_map[] = {
    {"size",     __guac_handshake_size_handler},
    {"audio",    __guac_handshake_audio_handler},
    {"video",    __guac_handshake_video_handler},
    {"image",    __guac_handshake_image_handler},
    {"timezone", __guac_handshake_timezone_handler},
    {"name",     __guac_handshake_name_handler},
    {NULL,       NULL}
};

/**
 * Parses a 64-bit integer from the given string. It is assumed that the string
 * will contain only decimal digits, with an optional leading minus sign.
 * The result of parsing a string which does not conform to this pattern is
 * undefined.
 *
 * @param str
 *     The string to parse, which must contain only decimal digits and an
 *     optional leading minus sign.
 *
 * @return
 *     The 64-bit integer value represented by the given string.
 */
static int64_t __guac_parse_int(const char* str) {

    int sign = 1;
    int64_t num = 0;

    for (; *str != '\0'; str++) {

        if (*str == '-')
            sign = -sign;
        else
            num = num * 10 + (*str - '0');

    }

    return num * sign;

}

/* Guacamole instruction handlers */

int __guac_handle_sync(guac_user* user, int argc, char** argv) {

    int frame_duration;

    guac_timestamp current = guac_timestamp_current();
    guac_timestamp timestamp = __guac_parse_int(argv[0]);

    /* Error if timestamp is in future */
    if (timestamp > user->client->last_sent_timestamp)
        return -1;

    /* Only update lag calculations if timestamp is sane */
    if (timestamp >= user->last_received_timestamp) {

        /* Update stored timestamp */
        user->last_received_timestamp = timestamp;

        /* Calculate length of frame, including network and processing lag */
        frame_duration = current - timestamp;

        /* Calculate processing lag portion of length of frame */
        int frame_processing_lag = 0;
        if (user->last_frame_duration != 0) {

            /* Calculate lag using the previous frame as a baseline */
            frame_processing_lag = frame_duration - user->last_frame_duration;

            /* Adjust back to zero if cumulative error leads to a negative
             * value */
            if (frame_processing_lag < 0)
                frame_processing_lag = 0;

        }

        /* Record baseline duration of frame by excluding lag (this is the
         * network round-trip time) */
        int estimated_rtt = frame_duration - frame_processing_lag;
        user->last_frame_duration = estimated_rtt;

        /* Calculate cumulative accumulated processing lag relative to server timeline */
        int processing_lag = current - user->last_received_timestamp - estimated_rtt;
        if (processing_lag < 0)
            processing_lag = 0;

        user->processing_lag = processing_lag;

    }

    /* Log received timestamp and calculated lag (at TRACE level only) */
    guac_user_log(user, GUAC_LOG_TRACE,
            "User confirmation of frame %" PRIu64 "ms received "
            "at %" PRIu64 "ms (processing_lag=%ims, estimated_rtt=%ims)",
            timestamp, current, user->processing_lag, user->last_frame_duration);

    if (user->sync_handler)
        return user->sync_handler(user, timestamp);
    return 0;
}

int __guac_handle_touch(guac_user* user, int argc, char** argv) {
    if (user->touch_handler)
        return user->touch_handler(
            user,
            atoi(argv[0]), /* id */
            atoi(argv[1]), /* x */
            atoi(argv[2]), /* y */
            atoi(argv[3]), /* x_radius */
            atoi(argv[4]), /* y_radius */
            atof(argv[5]), /* angle */
            atof(argv[6])  /* force */
        );
    return 0;
}

int __guac_handle_mouse(guac_user* user, int argc, char** argv) {
    if (user->mouse_handler)
        return user->mouse_handler(
            user,
            atoi(argv[0]), /* x */
            atoi(argv[1]), /* y */
            atoi(argv[2])  /* mask */
        );
    return 0;
}

int __guac_handle_key(guac_user* user, int argc, char** argv) {
    int keysym = atoi(argv[0]), pressed = atoi(argv[1]);
    int scancode = (argc >= 3 && argv[2] && argv[2][0]) ? atoi(argv[2]) : 0;

    if (user->key_handler_ext && scancode)
        return user->key_handler_ext(user, keysym, pressed, scancode);
    if (user->key_handler)
        return user->key_handler(user, keysym, pressed);
    return 0;
}

/**
 * Retrieves the existing user-level input stream having the given index. These
 * will be streams which were created by the remotely-connected user. If the
 * index is invalid or too large, this function will automatically respond with
 * an "ack" instruction containing an appropriate error code.
 *
 * @param user
 *     The user associated with the stream being retrieved.
 *
 * @param stream_index
 *     The index of the stream to retrieve.
 *
 * @return
 *     The stream associated with the given user and having the given index,
 *     or NULL if the index is invalid.
 */
static guac_stream* __get_input_stream(guac_user* user, int stream_index) {

    /* Validate stream index */
    if (stream_index < 0 || stream_index >= GUAC_USER_MAX_STREAMS) {

        guac_stream dummy_stream;
        dummy_stream.index = stream_index;

        guac_protocol_send_ack(user->socket, &dummy_stream,
                "Invalid stream index", GUAC_PROTOCOL_STATUS_CLIENT_BAD_REQUEST);
        return NULL;
    }

    return &(user->__input_streams[stream_index]);

}

/**
 * Retrieves the existing, in-progress (open) user-level input stream having
 * the given index. These will be streams which were created by the
 * remotely-connected user. If the index is invalid, too large, or the stream
 * is closed, this function will automatically respond with an "ack"
 * instruction containing an appropriate error code.
 *
 * @param user
 *     The user associated with the stream being retrieved.
 *
 * @param stream_index
 *     The index of the stream to retrieve.
 *
 * @return
 *     The in-progress (open)stream associated with the given user and having
 *     the given index, or NULL if the index is invalid or the stream is
 *     closed.
 */
static guac_stream* __get_open_input_stream(guac_user* user, int stream_index) {

    guac_stream* stream = __get_input_stream(user, stream_index);

    /* Fail if no such stream */
    if (stream == NULL)
        return NULL;

    /* Validate initialization of stream */
    if (stream->index == GUAC_USER_CLOSED_STREAM_INDEX) {

        guac_stream dummy_stream;
        dummy_stream.index = stream_index;

        guac_protocol_send_ack(user->socket, &dummy_stream,
                "Invalid stream index", GUAC_PROTOCOL_STATUS_CLIENT_BAD_REQUEST);
        return NULL;
    }

    return stream;

}

/**
 * Initializes and returns a new user-level input stream having the given
 * index, clearing any values that may have been assigned by a past use of the
 * underlying stream object storage. If the stream was already open, it will
 * first be closed and its end handlers invoked as if explicitly closed by the
 * user.
 *
 * @param user
 *     The user associated with the stream being initialized.
 *
 * @param stream_index
 *     The index of the stream to initialized.
 *
 * @return
 *     A new initialized user-level input stream having the given index, or
 *     NULL if the index is invalid.
 */
static guac_stream* __init_input_stream(guac_user* user, int stream_index) {

    guac_stream* stream = __get_input_stream(user, stream_index);

    /* Fail if no such stream */
    if (stream == NULL)
        return NULL;

    /* Force end of previous stream if open */
    if (stream->index != GUAC_USER_CLOSED_STREAM_INDEX) {

        /* Call stream handler if defined */
        if (stream->end_handler)
            stream->end_handler(user, stream);

        /* Fall back to global handler if defined */
        else if (user->end_handler)
            user->end_handler(user, stream);

    }

    /* Initialize stream */
    stream->index = stream_index;
    stream->data = NULL;
    stream->ack_handler = NULL;
    stream->blob_handler = NULL;
    stream->end_handler = NULL;

    return stream;

}

int __guac_handle_audio(guac_user* user, int argc, char** argv) {

    /* Pull corresponding stream */
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* If supported, call handler */
    if (user->audio_handler)
        return user->audio_handler(
            user,
            stream,
            argv[1] /* mimetype */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "Audio input unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;

}

int __guac_handle_clipboard(guac_user* user, int argc, char** argv) {

    /* Pull corresponding stream */
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* If supported, call handler */
    if (user->clipboard_handler)
        return user->clipboard_handler(
            user,
            stream,
            argv[1] /* mimetype */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "Clipboard unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;

}

int __guac_handle_size(guac_user* user, int argc, char** argv) {
    if (user->size_handler)
        return user->size_handler(
            user,
            atoi(argv[0]), /* width */
            atoi(argv[1])  /* height */
        );
    return 0;
}

int __guac_handle_file(guac_user* user, int argc, char** argv) {

    /* Pull corresponding stream */
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* If supported, call handler */
    if (user->file_handler)
        return user->file_handler(
            user,
            stream,
            argv[1], /* mimetype */
            argv[2]  /* filename */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "File transfer unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;
}

int __guac_handle_pipe(guac_user* user, int argc, char** argv) {

    /* Pull corresponding stream */
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* If supported, call handler */
    if (user->pipe_handler)
        return user->pipe_handler(
            user,
            stream,
            argv[1], /* mimetype */
            argv[2]  /* name */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "Named pipes unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;
}

int __guac_handle_argv(guac_user* user, int argc, char** argv) {

    /* Pull corresponding stream */
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* If supported, call handler */
    if (user->argv_handler)
        return user->argv_handler(
            user,
            stream,
            argv[1], /* mimetype */
            argv[2]  /* name */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "Reconfiguring in-progress connections unsupported",
            GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;
}

int __guac_handle_ack(guac_user* user, int argc, char** argv) {

    guac_stream* stream;

    /* Parse stream index */
    int stream_index = atoi(argv[0]);

    /* Ignore indices of client-level streams */
    if (stream_index % 2 != 0)
        return 0;

    /* Determine index within user-level array of streams */
    stream_index /= 2;

    /* Validate stream index */
    if (stream_index < 0 || stream_index >= GUAC_USER_MAX_STREAMS)
        return 0;

    stream = &(user->__output_streams[stream_index]);

    /* Validate initialization of stream */
    if (stream->index == GUAC_USER_CLOSED_STREAM_INDEX)
        return 0;

    /* Call stream handler if defined */
    if (stream->ack_handler)
        return stream->ack_handler(user, stream, argv[1],
                atoi(argv[2]));

    /* Fall back to global handler if defined */
    if (user->ack_handler)
        return user->ack_handler(user, stream, argv[1],
                atoi(argv[2]));

    return 0;
}

int __guac_handle_blob(guac_user* user, int argc, char** argv) {

    int stream_index = atoi(argv[0]);
    guac_stream* stream = __get_open_input_stream(user, stream_index);

    /* Fail if no such stream */
    if (stream == NULL)
        return 0;

    /* Call stream handler if defined */
    if (stream->blob_handler) {
        int length = guac_protocol_decode_base64(argv[1]);
        return stream->blob_handler(user, stream, argv[1],
            length);
    }

    /* Fall back to global handler if defined */
    if (user->blob_handler) {
        int length = guac_protocol_decode_base64(argv[1]);
        return user->blob_handler(user, stream, argv[1],
            length);
    }

    guac_protocol_send_ack(user->socket, stream,
            "File transfer unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;
}

int __guac_handle_end(guac_user* user, int argc, char** argv) {

    int result = 0;
    int stream_index = atoi(argv[0]);
    guac_stream* stream = __get_open_input_stream(user, stream_index);

    /* Fail if no such stream */
    if (stream == NULL)
        return 0;

    /* Call stream handler if defined */
    if (stream->end_handler)
        result = stream->end_handler(user, stream);

    /* Fall back to global handler if defined */
    else if (user->end_handler)
        result = user->end_handler(user, stream);

    /* Mark stream as closed */
    stream->index = GUAC_USER_CLOSED_STREAM_INDEX;
    return result;
}

int __guac_handle_get(guac_user* user, int argc, char** argv) {

    guac_object* object;

    /* Validate object index */
    int object_index = atoi(argv[0]);
    if (object_index < 0 || object_index >= GUAC_USER_MAX_OBJECTS)
        return 0;

    object = &(user->__objects[object_index]);

    /* Validate initialization of object */
    if (object->index == GUAC_USER_UNDEFINED_OBJECT_INDEX)
        return 0;

    /* Call object handler if defined */
    if (object->get_handler)
        return object->get_handler(
            user,
            object,
            argv[1] /* name */
        );

    /* Fall back to global handler if defined */
    if (user->get_handler)
        return user->get_handler(
            user,
            object,
            argv[1] /* name */
        );

    return 0;
}

int __guac_handle_put(guac_user* user, int argc, char** argv) {

    guac_object* object;

    /* Validate object index */
    int object_index = atoi(argv[0]);
    if (object_index < 0 || object_index >= GUAC_USER_MAX_OBJECTS)
        return 0;

    object = &(user->__objects[object_index]);

    /* Validate initialization of object */
    if (object->index == GUAC_USER_UNDEFINED_OBJECT_INDEX)
        return 0;

    /* Pull corresponding stream */
    int stream_index = atoi(argv[1]);
    guac_stream* stream = __init_input_stream(user, stream_index);
    if (stream == NULL)
        return 0;

    /* Call object handler if defined */
    if (object->put_handler)
        return object->put_handler(
            user,
            object, 
            stream,
            argv[2], /* mimetype */
            argv[3]  /* name */
        );

    /* Fall back to global handler if defined */
    if (user->put_handler)
        return user->put_handler(
            user,
            object,
            stream,
            argv[2], /* mimetype */
            argv[3]  /* name */
        );

    /* Otherwise, abort */
    guac_protocol_send_ack(user->socket, stream,
            "Object write unsupported", GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    return 0;
}

int __guac_handle_nop(guac_user* user, int argc, char** argv) {
    guac_user_log(user, GUAC_LOG_TRACE,
            "Received nop instruction");
    return 0;
}

int __guac_handle_disconnect(guac_user* user, int argc, char** argv) {
    guac_user_stop(user);
    return 0;
}

/* Guacamole handshake handler functions. */

int __guac_handshake_size_handler(guac_user* user, int argc, char** argv) {
    
    /* Validate size of instruction. */
    if (argc < 2) {
        guac_user_log(user, GUAC_LOG_ERROR, "Received \"size\" "
                "instruction lacked required arguments.");
        return 1;
    }
    
    /* Parse optimal screen dimensions from size instruction */
    user->info.optimal_width  = atoi(argv[0]);
    user->info.optimal_height = atoi(argv[1]);

    /* If DPI given, set the user resolution */
    if (argc >= 3)
        user->info.optimal_resolution = atoi(argv[2]);

    /* Otherwise, use a safe default for rough backwards compatibility */
    else
        user->info.optimal_resolution = 96;
    
    return 0;
    
}

int __guac_handshake_audio_handler(guac_user* user, int argc, char** argv) {

    guac_free_mimetypes((char **) user->info.audio_mimetypes);
    
    /* Store audio mimetypes */
    user->info.audio_mimetypes = (const char**) guac_copy_mimetypes(argv, argc);
    
    return 0;
    
}

int __guac_handshake_video_handler(guac_user* user, int argc, char** argv) {

    guac_free_mimetypes((char **) user->info.video_mimetypes);
    
    /* Store video mimetypes */
    user->info.video_mimetypes = (const char**) guac_copy_mimetypes(argv, argc);
    
    return 0;
    
}

int __guac_handshake_image_handler(guac_user* user, int argc, char** argv) {
    
    guac_free_mimetypes((char **) user->info.image_mimetypes);
    
    /* Store image mimetypes */
    user->info.image_mimetypes = (const char**) guac_copy_mimetypes(argv, argc);
    
    return 0;
    
}

int __guac_handshake_name_handler(guac_user* user, int argc, char** argv) {

    /* Free any past value for the user's name */
    guac_mem_free_const(user->info.name);

    /* If a value is provided for the name, copy it into guac_user. */
    if (argc > 0 && strcmp(argv[0], ""))
        user->info.name = (const char*) guac_strdup(argv[0]);

    /* No or empty value was provided, so make sure this is NULLed out. */
    else
        user->info.name = NULL;

    return 0;

}

int __guac_handshake_timezone_handler(guac_user* user, int argc, char** argv) {
    
    /* Free any past value */
    guac_mem_free_const(user->info.timezone);
    
    /* Store timezone, if present */
    if (argc > 0 && strcmp(argv[0], ""))
        user->info.timezone = (const char*) guac_strdup(argv[0]);
    
    else
        user->info.timezone = NULL;
    
    return 0;
    
}

char** guac_copy_mimetypes(char** mimetypes, int count) {

    int i;

    /* Allocate sufficient space for NULL-terminated array of mimetypes */
    char** mimetypes_copy = guac_mem_alloc(sizeof(char*),
            guac_mem_ckd_add_or_die(count, 1));

    /* Copy each provided mimetype */
    for (i = 0; i < count; i++)
        mimetypes_copy[i] = guac_strdup(mimetypes[i]);

    /* Terminate with NULL */
    mimetypes_copy[count] = NULL;

    return mimetypes_copy;

}

void guac_free_mimetypes(char** mimetypes) {

    if (mimetypes == NULL)
        return;
    
    char** current_mimetype = mimetypes;

    /* Free all strings within NULL-terminated mimetype array */
    while (*current_mimetype != NULL) {
        guac_mem_free(*current_mimetype);
        current_mimetype++;
    }

    /* Free the array itself, now that its contents have been freed */
    guac_mem_free(mimetypes);

}

int __guac_user_call_opcode_handler(__guac_instruction_handler_mapping* map,
        guac_user* user, const char* opcode, int argc, char** argv) {

    /* For each defined instruction */
    __guac_instruction_handler_mapping* current = map;
    while (current->opcode != NULL) {

        /* If recognized, call handler */
        if (strcmp(opcode, current->opcode) == 0)
            return current->handler(user, argc, argv);

        current++;
    }

    /* If unrecognized, log and ignore */
    guac_user_log(user, GUAC_LOG_DEBUG, "Handler not found for \"%s\"",
            opcode);
    return 0;

}

