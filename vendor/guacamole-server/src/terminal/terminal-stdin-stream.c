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

#include "terminal/common.h"
#include "terminal/terminal.h"
#include "terminal/terminal-priv.h"

#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

/**
 * Handler for "blob" instructions which writes the data of received
 * blobs to STDIN of the terminal associated with the stream.
 *
 * @see guac_user_blob_handler
 */
static int guac_terminal_input_stream_blob_handler(guac_user* user,
        guac_stream* stream, void* data, int length) {

    guac_terminal* term = (guac_terminal*) stream->data;

    /* Attempt to write received data */
    guac_terminal_lock(term);
    int result = guac_terminal_write_all(term->stdin_pipe_fd[1], data, length);
    guac_terminal_unlock(term);

    /* Acknowledge receipt of data and result of write attempt */
    if (result <= 0) {

        guac_user_log(user, GUAC_LOG_DEBUG,
                "Attempt to write to STDIN via an inbound stream failed.");

        guac_protocol_send_ack(user->socket, stream,
                "Attempt to write to STDIN failed.",
                GUAC_PROTOCOL_STATUS_SUCCESS);

    }
    else {

        guac_user_log(user, GUAC_LOG_DEBUG,
                "%i bytes successfully written to STDIN from an inbound stream.",
                length);

        guac_protocol_send_ack(user->socket, stream,
                "Data written to STDIN.",
                GUAC_PROTOCOL_STATUS_SUCCESS);

    }

    guac_socket_flush(user->socket);
    return 0;

}

/**
 * Handler for "end" instructions which disassociates the given
 * stream from the terminal, allowing user input to resume.
 *
 * @see guac_user_end_handler
 */
static int guac_terminal_input_stream_end_handler(guac_user* user,
        guac_stream* stream) {

    guac_terminal* term = (guac_terminal*) stream->data;

    /* Reset input stream, unblocking user input */
    guac_terminal_lock(term);
    term->input_stream = NULL;
    guac_terminal_unlock(term);

    guac_user_log(user, GUAC_LOG_DEBUG, "Inbound stream closed. User input "
            "will now resume affecting STDIN.");

    return 0;

}

/**
 * Internal implementation of guac_terminal_send_stream() which assumes
 * that the guac_terminal has already been locked through a call to
 * guac_terminal_lock(). The semantics of all parameters and the return
 * value are identical to guac_terminal_send_stream().
 *
 * @see guac_terminal_send_stream()
 */
static int __guac_terminal_send_stream(guac_terminal* term, guac_user* user,
        guac_stream* stream) {

    /* Deny redirecting STDIN if terminal is not started */
    if (!term->started) {

        guac_user_log(user, GUAC_LOG_DEBUG, "Attempt to direct the contents "
                "of an inbound stream to STDIN denied. The terminal is not "
                "yet ready for input.");

        guac_protocol_send_ack(user->socket, stream,
                "Terminal not yet started.",
                GUAC_PROTOCOL_STATUS_RESOURCE_CONFLICT);

        guac_socket_flush(user->socket);
        return 1;

    }

    /* If a stream is already being used for STDIN, deny creation of
     * further streams */
    if (term->input_stream != NULL) {

        guac_user_log(user, GUAC_LOG_DEBUG, "Attempt to direct the contents "
                "of an inbound stream to STDIN denied. STDIN is already "
                "being read from an inbound stream.");

        guac_protocol_send_ack(user->socket, stream,
                "STDIN is already being read from a stream.",
                GUAC_PROTOCOL_STATUS_RESOURCE_CONFLICT);

        guac_socket_flush(user->socket);
        return 1;

    }

    guac_user_log(user, GUAC_LOG_DEBUG, "Now reading STDIN from inbound "
            "stream. User input will no longer affect STDIN until the "
            "stream is closed.");

    stream->blob_handler = guac_terminal_input_stream_blob_handler;
    stream->end_handler = guac_terminal_input_stream_end_handler;
    stream->data = term;

    /* Block user input until stream is ended */
    term->input_stream = stream;

    /* Acknowledge redirection from stream */
    guac_protocol_send_ack(user->socket, stream,
            "Now reading STDIN from stream.",
            GUAC_PROTOCOL_STATUS_SUCCESS);

    guac_socket_flush(user->socket);
    return 0;

}

int guac_terminal_send_stream(guac_terminal* term, guac_user* user,
        guac_stream* stream) {

    int result;

    guac_terminal_lock(term);
    result = __guac_terminal_send_stream(term, user, stream);
    guac_terminal_unlock(term);

    return result;

}

