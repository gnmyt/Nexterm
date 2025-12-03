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
#include "guacamole/error.h"
#include "guacamole/parser.h"
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/user.h"
#include "user-handlers.h"

#include <pthread.h>
#include <stdlib.h>
#include <string.h>

/**
 * Parameters required by the user input thread.
 */
typedef struct guac_user_input_thread_params {

    /**
     * The parser which will be used throughout the user's session.
     */
    guac_parser* parser;

    /**
     * A reference to the connected user.
     */
    guac_user* user;

    /**
     * The number of microseconds to wait for instructions from a connected
     * user before closing the connection with an error.
     */
    int usec_timeout;

} guac_user_input_thread_params;

/**
 * Prints an error message using the logging facilities of the given user,
 * automatically including any information present in guac_error.
 *
 * @param user
 *     The guac_user associated with the error that occurred.
 *
 * @param level
 *     The level at which to log this message.
 *
 * @param message
 *     The message to log.
 */
static void guac_user_log_guac_error(guac_user* user,
        guac_client_log_level level, const char* message) {

    if (guac_error != GUAC_STATUS_SUCCESS) {

        /* If error message provided, include in log */
        if (guac_error_message != NULL)
            guac_user_log(user, level, "%s: %s", message,
                    guac_error_message);

        /* Otherwise just log with standard status string */
        else
            guac_user_log(user, level, "%s: %s", message,
                    guac_status_string(guac_error));

    }

    /* Just log message if no status code */
    else
        guac_user_log(user, level, "%s", message);

}

/**
 * Logs a reasonable explanatory message regarding handshake failure based on
 * the current value of guac_error.
 *
 * @param user
 *     The guac_user associated with the failed Guacamole protocol handshake.
 */
static void guac_user_log_handshake_failure(guac_user* user) {

    if (guac_error == GUAC_STATUS_CLOSED)
        guac_user_log(user, GUAC_LOG_DEBUG,
                "Guacamole connection closed during handshake");
    else if (guac_error == GUAC_STATUS_PROTOCOL_ERROR)
        guac_user_log(user, GUAC_LOG_ERROR,
                "Guacamole protocol violation. Perhaps the version of "
                "guacamole-client is incompatible with this version of "
                "libguac?");
    else
        guac_user_log(user, GUAC_LOG_WARNING,
                "Guacamole handshake failed: %s",
                guac_status_string(guac_error));

}

/**
 * The thread which handles all user input, calling event handlers for received
 * instructions.
 *
 * @param data
 *     A pointer to a guac_user_input_thread_params structure describing the
 *     user whose input is being handled and the guac_parser with which to
 *     handle it.
 *
 * @return
 *     Always NULL.
 */
static void* guac_user_input_thread(void* data) {

    guac_user_input_thread_params* params =
        (guac_user_input_thread_params*) data;

    int usec_timeout = params->usec_timeout;
    guac_user* user = params->user;
    guac_parser* parser = params->parser;
    guac_client* client = user->client;
    guac_socket* socket = user->socket;

    /* Guacamole user input loop */
    while (client->state == GUAC_CLIENT_RUNNING && user->active) {

        /* Read instruction, stop on error */
        if (guac_parser_read(parser, socket, usec_timeout)) {

            if (guac_error == GUAC_STATUS_TIMEOUT)
                guac_user_abort(user, GUAC_PROTOCOL_STATUS_CLIENT_TIMEOUT, "User is not responding.");

            else {
                if (guac_error != GUAC_STATUS_CLOSED)
                    guac_user_log_guac_error(user, GUAC_LOG_WARNING,
                            "Guacamole connection failure");
                guac_user_stop(user);
            }

            return NULL;
        }

        /* Reset guac_error and guac_error_message (user/client handlers are not
         * guaranteed to set these) */
        guac_error = GUAC_STATUS_SUCCESS;
        guac_error_message = NULL;

        /* Call handler, stop on error */
        if (__guac_user_call_opcode_handler(__guac_instruction_handler_map, 
                user, parser->opcode, parser->argc, parser->argv)) {

            /* Log error */
            guac_user_log_guac_error(user, GUAC_LOG_WARNING,
                    "User connection aborted");

            /* Log handler details */
            guac_user_log(user, GUAC_LOG_DEBUG, "Failing instruction handler in user was \"%s\"", parser->opcode);

            guac_user_stop(user);
            return NULL;
        }

    }

    return NULL;

}

/**
 * Starts the input/output threads of a new user. This function will block
 * until the user disconnects. If an error prevents the input/output threads
 * from starting, guac_user_stop() will be invoked on the given user.
 *
 * @param parser
 *     The guac_parser to use to handle all input from the given user.
 *
 * @param user
 *     The user whose associated I/O transfer threads should be started.
 *
 * @param usec_timeout
 *     The number of microseconds to wait for instructions from the given
 *     user before closing the connection with an error.
 *
 * @return
 *     Zero if the I/O threads started successfully and user has disconnected,
 *     or non-zero if the I/O threads could not be started.
 */
static int guac_user_start(guac_parser* parser, guac_user* user,
        int usec_timeout) {

    guac_user_input_thread_params params = {
        .parser = parser,
        .user = user,
        .usec_timeout = usec_timeout
    };

    pthread_t input_thread;

    if (pthread_create(&input_thread, NULL, guac_user_input_thread, (void*) &params)) {
        guac_user_log(user, GUAC_LOG_ERROR, "Unable to start input thread");
        guac_user_stop(user);
        return -1;
    }

    /* Wait for I/O threads */
    pthread_join(input_thread, NULL);

    /* Explicitly signal disconnect */
    guac_protocol_send_disconnect(user->socket);
    guac_socket_flush(user->socket);

    /* Done */
    return 0;

}

/**
 * This function loops through the received instructions during the handshake
 * with the client attempting to join the connection, and runs the handlers
 * for each of the opcodes, ending when the connect instruction is received.
 * Returns zero if the handshake completes successfully with the connect opcode,
 * or a non-zero value if an error occurs.
 * 
 * @param user
 *     The guac_user attempting to join the connection.
 * 
 * @param parser
 *     The parser used to examine the received data.
 * 
 * @param usec_timeout
 *     The timeout, in microseconds, for reading the instructions.
 * 
 * @return
 *     Zero if the handshake completes successfully with the connect opcode,
 *     or non-zero if an error occurs.
 */
static int __guac_user_handshake(guac_user* user, guac_parser* parser,
        int usec_timeout) {
    
    guac_socket* socket = user->socket;
    
    /* Handle each of the opcodes. */
    while (guac_parser_read(parser, socket, usec_timeout) == 0) {
        
        /* If we receive the connect opcode, we're done. */
        if (strcmp(parser->opcode, "connect") == 0)
            return 0;
        
        guac_user_log(user, GUAC_LOG_DEBUG, "Processing instruction: %s",
                parser->opcode);
        
        /* Run instruction handler for opcode with arguments. */
        if (__guac_user_call_opcode_handler(__guac_handshake_handler_map, user,
                parser->opcode, parser->argc, parser->argv)) {
            
            guac_user_log_handshake_failure(user);
            guac_user_log_guac_error(user, GUAC_LOG_DEBUG,
                    "Error handling instruction during handshake.");
            guac_user_log(user, GUAC_LOG_DEBUG, "Failed opcode: %s",
                    parser->opcode);

            guac_parser_free(parser);
            return 1;
            
        }
        
    }
    
    /* If we get here it's because we never got the connect instruction. */
    guac_user_log(user, GUAC_LOG_ERROR,
            "Handshake failed, \"connect\" instruction was not received.");
    return 1;
}

int guac_user_handle_connection(guac_user* user, int usec_timeout) {

    guac_socket* socket = user->socket;
    guac_client* client = user->client;
    
    user->info.audio_mimetypes = NULL;
    user->info.image_mimetypes = NULL;
    user->info.video_mimetypes = NULL;
    user->info.name = NULL;
    user->info.timezone = NULL;
    
    /* Count number of arguments. */
    int num_args;
    for (num_args = 0; client->args[num_args] != NULL; num_args++);
    
    /* Send args */
    if (guac_protocol_send_args(socket, client->args)
            || guac_socket_flush(socket)) {

        /* Log error */
        guac_user_log_handshake_failure(user);
        guac_user_log_guac_error(user, GUAC_LOG_DEBUG,
                "Error sending \"args\" to new user");

        return 1;
    }

    guac_parser* parser = guac_parser_alloc();

    /* Perform the handshake with the client. */
    if (__guac_user_handshake(user, parser, usec_timeout)) {
        guac_parser_free(parser);
        return 1;
    }

    /* Acknowledge connection availability */
    guac_protocol_send_ready(socket, client->connection_id);
    guac_socket_flush(socket);
    
    /* Verify argument count. */
    if (parser->argc != (num_args + 1)) {
        guac_client_log(client, GUAC_LOG_ERROR, "Client did not return the "
                "expected number of arguments.");
        return 1;
    }
    
    /* Attempt to join user to connection. */
    if (guac_client_add_user(client, user, (parser->argc - 1), parser->argv + 1))
        guac_client_log(client, GUAC_LOG_ERROR, "User \"%s\" could NOT "
                "join connection \"%s\"", user->user_id, client->connection_id);

    /* Begin user connection if join successful */
    else {

        guac_client_log(client, GUAC_LOG_INFO, "User \"%s\" joined connection "
                "\"%s\" (%i users now present)", user->user_id,
                client->connection_id, client->connected_users);
        if (strcmp(parser->argv[0],"") != 0) {
            guac_client_log(client, GUAC_LOG_DEBUG, "Client is using protocol "
                    "version \"%s\"", parser->argv[0]);
            user->info.protocol_version = guac_protocol_string_to_version(parser->argv[0]);
        }
        else {
            guac_client_log(client, GUAC_LOG_DEBUG, "Client has not defined "
                    "its protocol version.");
            user->info.protocol_version = GUAC_PROTOCOL_VERSION_1_0_0;
        }

        /* Handle user I/O, wait for connection to terminate */
        guac_user_start(parser, user, usec_timeout);

        /* Remove/free user */
        guac_client_remove_user(client, user);
        guac_client_log(client, GUAC_LOG_INFO, "User \"%s\" disconnected (%i "
                "users remain)", user->user_id, client->connected_users);

    }
    
    /* Free mimetype character arrays. */
    guac_free_mimetypes((char **) user->info.audio_mimetypes);
    guac_free_mimetypes((char **) user->info.image_mimetypes);
    guac_free_mimetypes((char **) user->info.video_mimetypes);
    
    /* Free name and timezone info. */
    guac_mem_free_const(user->info.name);
    guac_mem_free_const(user->info.timezone);
    
    guac_parser_free(parser);

    /* Successful disconnect */
    return 0;

}

