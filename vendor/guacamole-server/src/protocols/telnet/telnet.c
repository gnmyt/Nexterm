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

#include "argv.h"
#include "telnet.h"
#include "terminal/terminal.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/recording.h>
#include <guacamole/tcp.h>
#include <guacamole/timestamp.h>
#include <guacamole/wol-constants.h>
#include <guacamole/wol.h>
#include <libtelnet.h>

#include <errno.h>
#include <netdb.h>
#include <netinet/in.h>
#include <poll.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

/**
 * Support levels for various telnet options, required for connection
 * negotiation by telnet_init(), part of libtelnet.
 */
static const telnet_telopt_t __telnet_options[] = {
    { TELNET_TELOPT_ECHO,        TELNET_WONT, TELNET_DO   },
    { TELNET_TELOPT_TTYPE,       TELNET_WILL, TELNET_DONT },
    { TELNET_TELOPT_COMPRESS2,   TELNET_WONT, TELNET_DO   },
    { TELNET_TELOPT_MSSP,        TELNET_WONT, TELNET_DO   },
    { TELNET_TELOPT_NAWS,        TELNET_WILL, TELNET_DONT },
    { TELNET_TELOPT_NEW_ENVIRON, TELNET_WILL, TELNET_DONT },
    { -1, 0, 0 }
};

/**
 * Write the entire buffer given to the specified file descriptor, retrying
 * the write automatically if necessary. This function will return a value
 * not equal to the buffer's size iff an error occurs which prevents all
 * future writes.
 *
 * @param fd The file descriptor to write to.
 * @param buffer The buffer to write.
 * @param size The number of bytes from the buffer to write.
 */
static int __guac_telnet_write_all(int fd, const char* buffer, int size) {

    int remaining = size;
    while (remaining > 0) {

        /* Attempt to write data */
        int ret_val = write(fd, buffer, remaining);
        if (ret_val <= 0)
            return -1;

        /* If successful, continue with what data remains (if any) */
        remaining -= ret_val;
        buffer += ret_val;

    }

    return size;

}

/**
 * Matches the given line against the given regex, returning true and sending
 * the given value if a match is found. An enter keypress is automatically
 * sent after the value is sent.
 *
 * @param client
 *     The guac_client associated with the telnet session.
 *
 * @param regex
 *     The regex to search for within the given line buffer.
 *
 * @param value
 *     The string value to send through STDIN of the telnet session if a
 *     match is found, or NULL if no value should be sent.
 *
 * @param line_buffer
 *     The line of character data to test.
 *
 * @return
 *     true if a match is found, false otherwise.
 */
static bool guac_telnet_regex_exec(guac_client* client, regex_t* regex,
        const char* value, const char* line_buffer) {

    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;

    /* Send value upon match */
    if (regexec(regex, line_buffer, 0, NULL, 0) == 0) {

        /* Send value */
        if (value != NULL) {
            guac_terminal_send_string(telnet_client->term, value);
            guac_terminal_send_string(telnet_client->term, "\x0D");
        }

        /* Stop searching for prompt */
        return true;

    }

    return false;

}

/**
 * Matches the given line against the various stored regexes, automatically
 * sending the configured username, password, or reporting login
 * success/failure depending on context. If no search is in progress, either
 * because no regexes have been defined or because all applicable searches have
 * completed, this function has no effect.
 *
 * @param client
 *     The guac_client associated with the telnet session.
 *
 * @param line_buffer
 *     The line of character data to test.
 */
static void guac_telnet_search_line(guac_client* client, const char* line_buffer) {

    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;
    guac_telnet_settings* settings = telnet_client->settings;

    /* Continue search for username prompt */
    if (settings->username_regex != NULL) {
        if (guac_telnet_regex_exec(client, settings->username_regex,
                    settings->username, line_buffer)) {
            guac_client_log(client, GUAC_LOG_DEBUG, "Username sent");
            guac_telnet_regex_free(&settings->username_regex);
        }
    }

    /* Continue search for password prompt */
    if (settings->password_regex != NULL) {
        if (guac_telnet_regex_exec(client, settings->password_regex,
                    settings->password, line_buffer)) {

            guac_client_log(client, GUAC_LOG_DEBUG, "Password sent");

            /* Do not continue searching for username/password once password is sent */
            guac_telnet_regex_free(&settings->username_regex);
            guac_telnet_regex_free(&settings->password_regex);

        }
    }

    /* Continue search for login success */
    if (settings->login_success_regex != NULL) {
        if (guac_telnet_regex_exec(client, settings->login_success_regex,
                    NULL, line_buffer)) {

            /* Allow terminal to render now that login has been deemed successful */
            guac_client_log(client, GUAC_LOG_DEBUG, "Login successful");
            guac_terminal_start(telnet_client->term);

            /* Stop all searches */
            guac_telnet_regex_free(&settings->username_regex);
            guac_telnet_regex_free(&settings->password_regex);
            guac_telnet_regex_free(&settings->login_success_regex);
            guac_telnet_regex_free(&settings->login_failure_regex);

        }
    }

    /* Continue search for login failure */
    if (settings->login_failure_regex != NULL) {
        if (guac_telnet_regex_exec(client, settings->login_failure_regex,
                    NULL, line_buffer)) {

            /* Advise that login has failed and connection should be closed */
            guac_client_abort(client,
                    GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                    "Login failed");

            /* Stop all searches */
            guac_telnet_regex_free(&settings->username_regex);
            guac_telnet_regex_free(&settings->password_regex);
            guac_telnet_regex_free(&settings->login_success_regex);
            guac_telnet_regex_free(&settings->login_failure_regex);

        }
    }

}

/**
 * Searches for a line matching the various stored regexes, automatically
 * sending the configured username, password, or reporting login
 * success/failure depending on context. If no search is in progress, either
 * because no regexes have been defined or because all applicable searches
 * have completed, this function has no effect.
 *
 * @param client
 *     The guac_client associated with the telnet session.
 *
 * @param buffer
 *     The buffer of received data to search through.
 *
 * @param size
 *     The size of the given buffer, in bytes.
 */
static void guac_telnet_search(guac_client* client, const char* buffer, int size) {

    static char line_buffer[1024] = {0};
    static int length = 0;

    /* Append all characters in buffer to current line */
    const char* current = buffer;
    for (int i = 0; i < size; i++) {

        char c = *(current++);

        /* Attempt pattern match and clear buffer upon reading newline */
        if (c == '\n') {
            if (length > 0) {
                line_buffer[length] = '\0';
                guac_telnet_search_line(client, line_buffer);
                length = 0;
            }
        }

        /* Append all non-newline characters to line buffer as long as space
         * remains */
        else if (length < sizeof(line_buffer) - 1)
            line_buffer[length++] = c;

    }

    /* Attempt pattern match if an unfinished line remains (may be a prompt) */
    if (length > 0) {
        line_buffer[length] = '\0';
        guac_telnet_search_line(client, line_buffer);
    }

}

/**
 * Event handler, as defined by libtelnet. This function is passed to
 * telnet_init() and will be called for every event fired by libtelnet,
 * including feature enable/disable and receipt/transmission of data.
 */
static void __guac_telnet_event_handler(telnet_t* telnet, telnet_event_t* event, void* data) {

    guac_client* client = (guac_client*) data;
    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;
    guac_telnet_settings* settings = telnet_client->settings;

    switch (event->type) {

        /* Terminal output received */
        case TELNET_EV_DATA:
            guac_terminal_write(telnet_client->term, event->data.buffer, event->data.size);
            guac_telnet_search(client, event->data.buffer, event->data.size);
            break;

        /* Data destined for remote end */
        case TELNET_EV_SEND:
            if (__guac_telnet_write_all(telnet_client->socket_fd, event->data.buffer, event->data.size)
                    != event->data.size)
                guac_client_stop(client);
            break;

        /* Remote feature enabled */
        case TELNET_EV_WILL:
            if (event->neg.telopt == TELNET_TELOPT_ECHO)
                telnet_client->echo_enabled = 0; /* Disable local echo, as remote will echo */
            break;

        /* Remote feature disabled */
        case TELNET_EV_WONT:
            if (event->neg.telopt == TELNET_TELOPT_ECHO)
                telnet_client->echo_enabled = 1; /* Enable local echo, as remote won't echo */
            break;

        /* Local feature enable */
        case TELNET_EV_DO:
            if (event->neg.telopt == TELNET_TELOPT_NAWS) {
                telnet_client->naws_enabled = 1;
                guac_telnet_send_naws(telnet,
                        guac_terminal_get_columns(telnet_client->term),
                        guac_terminal_get_rows(telnet_client->term));
            }
            break;

        /* Terminal type request */
        case TELNET_EV_TTYPE:
            if (event->ttype.cmd == TELNET_TTYPE_SEND)
                telnet_ttype_is(telnet_client->telnet, settings->terminal_type);
            break;

        /* Environment request */
        case TELNET_EV_ENVIRON:

            /* Only send USER if entire environment was requested */
            if (event->environ.size == 0)
                guac_telnet_send_user(telnet, settings->username);

            break;

        /* Connection warnings */
        case TELNET_EV_WARNING:
            guac_client_log(client, GUAC_LOG_WARNING, "%s", event->error.msg);
            break;

        /* Connection errors */
        case TELNET_EV_ERROR:
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR,
                    "Telnet connection closing with error: %s", event->error.msg);
            break;

        /* Ignore other events */
        default:
            break;

    }

}

/**
 * Input thread, started by the main telnet client thread. This thread
 * continuously reads from the terminal's STDIN and transfers all read
 * data to the telnet connection.
 *
 * @param data The current guac_client instance.
 * @return Always NULL.
 */
static void* __guac_telnet_input_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;

    char buffer[8192];
    int bytes_read;

    /* Write all data read */
    while ((bytes_read = guac_terminal_read_stdin(telnet_client->term, buffer, sizeof(buffer))) > 0) {
        telnet_send(telnet_client->telnet, buffer, bytes_read);
        if (telnet_client->echo_enabled)
            guac_terminal_write(telnet_client->term, buffer, bytes_read);
    }

    return NULL;

}

/**
 * Connects to the telnet server specified within the data associated
 * with the given guac_client, which will have been populated by
 * guac_client_init.
 *
 * @return The connected telnet instance, if successful, or NULL if the
 *         connection fails for any reason.
 */
static telnet_t* __guac_telnet_create_session(guac_client* client) {

    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;
    guac_telnet_settings* settings = telnet_client->settings;

    int fd = guac_tcp_connect(settings->hostname, settings->port, settings->timeout);

    /* Open telnet session */
    telnet_t* telnet = telnet_init(__telnet_options, __guac_telnet_event_handler, 0, client);
    if (telnet == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR, "Telnet client allocation failed.");
        return NULL;
    }

    /* Save file descriptor */
    telnet_client->socket_fd = fd;

    return telnet;

}

/**
 * Sends a 16-bit value over the given telnet connection with the byte order
 * required by the telnet protocol.
 *
 * @param telnet The telnet connection to use.
 * @param value The value to send.
 */
static void __guac_telnet_send_uint16(telnet_t* telnet, uint16_t value) {

    unsigned char buffer[2];
    buffer[0] = (value >> 8) & 0xFF;
    buffer[1] =  value       & 0xFF;

    telnet_send(telnet, (char*) buffer, 2);

}

/**
 * Sends an 8-bit value over the given telnet connection.
 *
 * @param telnet The telnet connection to use.
 * @param value The value to send.
 */
static void __guac_telnet_send_uint8(telnet_t* telnet, uint8_t value) {
    telnet_send(telnet, (char*) (&value), 1);
}

void guac_telnet_send_naws(telnet_t* telnet, uint16_t width, uint16_t height) {
    telnet_begin_sb(telnet, TELNET_TELOPT_NAWS);
    __guac_telnet_send_uint16(telnet, width);
    __guac_telnet_send_uint16(telnet, height);
    telnet_finish_sb(telnet);
}

void guac_telnet_send_user(telnet_t* telnet, const char* username) {

    /* IAC SB NEW-ENVIRON IS */
    telnet_begin_sb(telnet, TELNET_TELOPT_NEW_ENVIRON);
    __guac_telnet_send_uint8(telnet, TELNET_ENVIRON_IS);

    /* Only send username if defined */
    if (username != NULL) {

        /* VAR "USER" */
        __guac_telnet_send_uint8(telnet, TELNET_ENVIRON_VAR);
        telnet_send(telnet, "USER", 4);

        /* VALUE username */
        __guac_telnet_send_uint8(telnet, TELNET_ENVIRON_VALUE);
        telnet_send(telnet, username, strlen(username));

    }

    /* IAC SE */
    telnet_finish_sb(telnet);

}

/**
 * Waits for data on the given file descriptor for up to one second. The
 * return value is identical to that of select(): 0 on timeout, < 0 on
 * error, and > 0 on success.
 *
 * @param socket_fd The file descriptor to wait for.
 * @return A value greater than zero on success, zero on timeout, and
 *         less than zero on error.
 */
static int __guac_telnet_wait(int socket_fd) {

    /* Build array of file descriptors */
    struct pollfd fds[] = {{
        .fd      = socket_fd,
        .events  = POLLIN,
        .revents = 0,
    }};

    /* Wait for one second */
    return poll(fds, 1, 1000);

}

void* guac_telnet_client_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;
    guac_telnet_settings* settings = telnet_client->settings;

    pthread_t input_thread;
    char buffer[8192];
    int wait_result;

    /* If Wake-on-LAN is enabled, attempt to wake. */
    if (settings->wol_send_packet) {

        /**
         * If wait time is set, send the wake packet and try to connect to the
         * server, failing if the server does not respond.
         */
        if (settings->wol_wait_time > 0) {
            guac_client_log(client, GUAC_LOG_DEBUG, "Sending Wake-on-LAN packet, "
                    "and pausing for %d seconds.", settings->wol_wait_time);

            /* Send the Wake-on-LAN request and wait until the server is responsive. */
            if (guac_wol_wake_and_wait(settings->wol_mac_addr,
                    settings->wol_broadcast_addr,
                    settings->wol_udp_port,
                    settings->wol_wait_time,
                    GUAC_WOL_DEFAULT_CONNECT_RETRIES,
                    settings->hostname,
                    settings->port,
                    settings->timeout)) {
                guac_client_log(client, GUAC_LOG_ERROR, "Failed to send WOL packet or connect to remote server.");
                return NULL;
            }
        }

        /* Just send the packet and continue the connection, or return if failed. */
        else if(guac_wol_wake(settings->wol_mac_addr,
                    settings->wol_broadcast_addr,
                    settings->wol_udp_port)) {
            guac_client_log(client, GUAC_LOG_ERROR, "Failed to send WOL packet.");
            return NULL;
        }
    }

    /* Set up screen recording, if requested */
    if (settings->recording_path != NULL) {
        telnet_client->recording = guac_recording_create(client,
                settings->recording_path,
                settings->recording_name,
                settings->create_recording_path,
                !settings->recording_exclude_output,
                !settings->recording_exclude_mouse,
                0, /* Touch events not supported */
                settings->recording_include_keys,
                settings->recording_write_existing);
    }

    /* Create terminal options with required parameters */
    guac_terminal_options* options = guac_terminal_options_create(
            settings->width, settings->height, settings->resolution);

    /* Set optional parameters */
    options->disable_copy = settings->disable_copy;
    options->max_scrollback = settings->max_scrollback;
    options->font_name = settings->font_name;
    options->font_size = settings->font_size;
    options->color_scheme = settings->color_scheme;
    options->backspace = settings->backspace;

    /* Create terminal */
    telnet_client->term = guac_terminal_create(client, options);

    /* Free options struct now that it's been used */
    guac_mem_free(options);

    /* Fail if terminal init failed */
    if (telnet_client->term == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Terminal initialization failed");
        return NULL;
    }

    /* Send current values of exposed arguments to owner only */
    guac_client_for_owner(client, guac_telnet_send_current_argv,
            telnet_client);

    /* Set up typescript, if requested */
    if (settings->typescript_path != NULL) {
        guac_terminal_create_typescript(telnet_client->term,
                settings->typescript_path,
                settings->typescript_name,
                settings->create_typescript_path,
                settings->typescript_write_existing);
    }

    /* Open telnet session */
    telnet_client->telnet = __guac_telnet_create_session(client);
    if (telnet_client->telnet == NULL) {
        /* Already aborted within __guac_telnet_create_session() */
        return NULL;
    }

    /* Logged in */
    guac_client_log(client, GUAC_LOG_INFO, "Telnet connection successful.");

    /* Allow terminal to render if login success/failure detection is not
     * enabled */
    if (settings->login_success_regex == NULL
            && settings->login_failure_regex == NULL)
        guac_terminal_start(telnet_client->term);

    /* Start input thread */
    if (pthread_create(&(input_thread), NULL, __guac_telnet_input_thread, (void*) client)) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR, "Unable to start input thread");
        return NULL;
    }

    /* While data available, write to terminal */
    while ((wait_result = __guac_telnet_wait(telnet_client->socket_fd)) >= 0) {

        /* Resume waiting of no data available */
        if (wait_result == 0)
            continue;

        int bytes_read = read(telnet_client->socket_fd, buffer, sizeof(buffer));
        if (bytes_read <= 0)
            break;

        telnet_recv(telnet_client->telnet, buffer, bytes_read);

    }

    /* Kill client and Wait for input thread to die */
    guac_client_stop(client);
    pthread_join(input_thread, NULL);

    guac_client_log(client, GUAC_LOG_INFO, "Telnet connection ended.");
    return NULL;

}

