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

#ifndef _GUAC_USER_H
#define _GUAC_USER_H

/**
 * Defines the guac_user object, which represents a physical connection
 * within a larger, possibly shared, logical connection represented by a
 * guac_client.
 *
 * @file user.h
 */

#include "client-types.h"
#include "layer-types.h"
#include "pool-types.h"
#include "socket-types.h"
#include "stream-types.h"
#include "timestamp-types.h"
#include "user-constants.h"
#include "user-fntypes.h"
#include "user-types.h"

#include <cairo/cairo.h>

#include <pthread.h>
#include <stdarg.h>

struct guac_user_info {

    /**
     * The number of pixels the remote client requests for the display width.
     * This need not be honored by a client plugin implementation, but if the
     * underlying protocol of the client plugin supports dynamic sizing of the
     * screen, honoring the display size request is recommended.
     */
    int optimal_width;

    /**
     * The number of pixels the remote client requests for the display height.
     * This need not be honored by a client plugin implementation, but if the
     * underlying protocol of the client plugin supports dynamic sizing of the
     * screen, honoring the display size request is recommended.
     */
    int optimal_height;

    /**
     * NULL-terminated array of client-supported audio mimetypes. If the client
     * does not support audio at all, this will be NULL.
     */
    const char** audio_mimetypes;

    /**
     * NULL-terminated array of client-supported video mimetypes. If the client
     * does not support video at all, this will be NULL.
     */
    const char** video_mimetypes;

    /**
     * NULL-terminated array of client-supported image mimetypes. Though all
     * supported image mimetypes will be listed here, it can be safely assumed
     * that all clients will support at least "image/png" and "image/jpeg".
     */
    const char** image_mimetypes;

    /**
     * The DPI of the physical remote display if configured for the optimal
     * width/height combination described here. This need not be honored by
     * a client plugin implementation, but if the underlying protocol of the
     * client plugin supports dynamic sizing of the screen, honoring the
     * stated resolution of the display size request is recommended.
     */
    int optimal_resolution;

    /**
     * The timezone of the remote system.  If the client does not provide
     * a specific timezone then this will be NULL.  The format of the timezone
     * is the standard tzdata naming convention.
     */
    const char* timezone;
    
    /**
     * The Guacamole protocol version that the remote system supports, allowing
     * for feature support to be negotiated between client and server.
     */
    guac_protocol_version protocol_version;

    /**
     * The human-readable name of the Guacamole user, supplied by the client
     * during the handshake. This is an arbitrary value, with no requirements or
     * constraints, including that it need not uniquely identify the user.
     * If the client does not provide a name then this will be NULL.
     */
    const char* name;

};

struct guac_user {

    /**
     * The guac_client to which this user belongs.
     */
    guac_client* client;

    /**
     * This user's actual socket. Data written to this socket will
     * be received by this user alone, and data sent by this specific
     * user will be received by this socket.
     */
    guac_socket* socket;

    /**
     * The unique identifier allocated for this user, which may be used within
     * the Guacamole protocol to refer to this user.  This identifier is
     * guaranteed to be unique from all existing connections and users, and
     * will not collide with any available protocol names.
     */
    char* user_id;

    /**
     * Non-zero if this user is the owner of the associated connection, zero
     * otherwise. The owner is the user which created the connection.
     */
    int owner;

    /**
     * Non-zero if this user is active (connected), and zero otherwise. When
     * the user is created, this will be set to a non-zero value. If an event
     * occurs which requires that the user disconnect, or the user has
     * disconnected, this will be reset to zero.
     */
    int active;

    /**
     * The previous user in the group of users within the same logical
     * connection.  This is currently only used internally by guac_client to
     * track its set of connected users. To iterate connected users, use
     * guac_client_foreach_user().
     */
    guac_user* __prev;

    /**
     * The next user in the group of users within the same logical connection.
     * This is currently only used internally by guac_client to track its set
     * of connected users. To iterate connected users, use
     * guac_client_foreach_user().
     */
    guac_user* __next;

    /**
     * The time (in milliseconds) of receipt of the last sync message from
     * the user.
     */
    guac_timestamp last_received_timestamp;

    /**
     * The duration of the last frame rendered by the user, in milliseconds.
     * This duration will include network and processing lag, and thus should
     * be slightly higher than the true frame duration.
     */
    int last_frame_duration;

    /**
     * The overall lag experienced by the user relative to the stream of
     * frames, roughly excluding network lag.
     */
    int processing_lag;

    /**
     * Information structure containing properties exposed by the remote
     * user during the initial handshake process.
     */
    guac_user_info info;

    /**
     * Pool of stream indices.
     */
    guac_pool* __stream_pool;

    /**
     * All available output streams (data going to connected user).
     */
    guac_stream* __output_streams;

    /**
     * All available input streams (data coming from connected user).
     */
    guac_stream* __input_streams;

    /**
     * Pool of object indices.
     */
    guac_pool* __object_pool;

    /**
     * All available objects (arbitrary sets of named streams).
     */
    guac_object* __objects;

    /**
     * Arbitrary user-specific data.
     */
    void* data;

    /**
     * Handler for mouse events sent by the Gaucamole web-client.
     *
     * The handler takes the integer mouse X and Y coordinates, as well as
     * a button mask containing the bitwise OR of all button values currently
     * being pressed. Those values are:
     *
     * <table>
     *     <tr><th>Button</th>          <th>Value</th></tr>
     *     <tr><td>Left</td>            <td>1</td></tr>
     *     <tr><td>Middle</td>          <td>2</td></tr>
     *     <tr><td>Right</td>           <td>4</td></tr>
     *     <tr><td>Scrollwheel Up</td>  <td>8</td></tr>
     *     <tr><td>Scrollwheel Down</td><td>16</td></tr>
     * </table>

     * Example:
     * @code
     *     int mouse_handler(guac_user* user, int x, int y, int button_mask);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->mouse_handler = mouse_handler;
     *     }
     * @endcode
     */
    guac_user_mouse_handler* mouse_handler;

    /**
     * Handler for key events sent by the Guacamole web-client.
     *
     * The handler takes the integer X11 keysym associated with the key
     * being pressed/released, and an integer representing whether the key
     * is being pressed (1) or released (0).
     *
     * Example:
     * @code
     *     int key_handler(guac_user* user, int keysym, int pressed);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->key_handler = key_handler;
     *     }
     * @endcode
     */
    guac_user_key_handler* key_handler;

    /**
     * Handler for clipboard events sent by the Guacamole web-client. This
     * handler will be called whenever the web-client sets the data of the
     * clipboard.
     *
     * The handler takes a guac_stream, which contains the stream index and
     * will persist through the duration of the transfer, and the mimetype
     * of the data being transferred.
     *
     * Example:
     * @code
     *     int clipboard_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->clipboard_handler = clipboard_handler;
     *     }
     * @endcode
     */
    guac_user_clipboard_handler* clipboard_handler;

    /**
     * Handler for size events sent by the Guacamole web-client.
     *
     * The handler takes an integer width and integer height, representing
     * the current visible screen area of the client.
     *
     * Example:
     * @code
     *     int size_handler(guac_user* user, int width, int height);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->size_handler = size_handler;
     *     }
     * @endcode
     */
    guac_user_size_handler* size_handler;

    /**
     * Handler for file events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, the mimetype of
     * the file being transferred, and the filename.
     *
     * Example:
     * @code
     *     int file_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype, char* filename);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->file_handler = file_handler;
     *     }
     * @endcode
     */
    guac_user_file_handler* file_handler;

    /**
     * Handler for pipe events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, the mimetype of
     * the data being transferred, and the pipe name.
     *
     * Example:
     * @code
     *     int pipe_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype, char* name);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->pipe_handler = pipe_handler;
     *     }
     * @endcode
     */
    guac_user_pipe_handler* pipe_handler;

    /**
     * Handler for ack events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, a string containing
     * the error or status message, and a status code.
     *
     * Example:
     * @code
     *     int ack_handler(guac_user* user, guac_stream* stream,
     *             char* error, guac_protocol_status status);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->ack_handler = ack_handler;
     *     }
     * @endcode
     */
    guac_user_ack_handler* ack_handler;

    /**
     * Handler for blob events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, an arbitrary buffer
     * containing the blob, and the length of the blob.
     *
     * Example:
     * @code
     *     int blob_handler(guac_user* user, guac_stream* stream,
     *             void* data, int length);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->blob_handler = blob_handler;
     *     }
     * @endcode
     */
    guac_user_blob_handler* blob_handler;

    /**
     * Handler for stream end events sent by the Guacamole web-client.
     *
     * The handler takes only a guac_stream which contains the stream index.
     * This guac_stream will be disposed of immediately after this event is
     * finished.
     *
     * Example:
     * @code
     *     int end_handler(guac_user* user, guac_stream* stream);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->end_handler = end_handler;
     *     }
     * @endcode
     */
    guac_user_end_handler* end_handler;

    /**
     * Handler for sync events sent by the Guacamole web-client. Sync events
     * are used to track per-user latency.
     *
     * The handler takes only a guac_timestamp which contains the timestamp
     * received from the user. Latency can be determined by comparing this
     * timestamp against the last_sent_timestamp of guac_client.
     *
     * Example:
     * @code
     *     int sync_handler(guac_user* user, guac_timestamp timestamp);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->sync_handler = sync_handler;
     *     }
     * @endcode
     */
    guac_user_sync_handler* sync_handler;

    /**
     * Handler for leave events fired by the guac_client when a guac_user
     * is leaving an active connection.
     *
     * The handler takes only a guac_user which will be the guac_user that
     * left the connection. This guac_user will be disposed of immediately
     * after this event is finished.
     *
     * Example:
     * @code
     *     int leave_handler(guac_user* user);
     *
     *     int my_join_handler(guac_user* user, int argv, char** argv) {
     *         user->leave_handler = leave_handler;
     *     }
     * @endcode
     */
    guac_user_leave_handler* leave_handler;

    /**
     * Handler for get events sent by the Guacamole web-client.
     *
     * The handler takes a guac_object, containing the object index which will
     * persist through the duration of the transfer, and the name of the stream
     * being requested. It is up to the get handler to create the required body
     * stream.
     *
     * Example:
     * @code
     *     int get_handler(guac_user* user, guac_object* object,
     *             char* name);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->get_handler = get_handler;
     *     }
     * @endcode
     */
    guac_user_get_handler* get_handler;

    /**
     * Handler for put events sent by the Guacamole web-client.
     *
     * The handler takes a guac_object and guac_stream, which each contain their
     * respective indices which will persist through the duration of the
     * transfer, the mimetype of the data being transferred, and the name of
     * the stream within the object being written to.
     *
     * Example:
     * @code
     *     int put_handler(guac_user* user, guac_object* object,
     *             guac_stream* stream, char* mimetype, char* name);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->put_handler = put_handler;
     *     }
     * @endcode
     */
    guac_user_put_handler* put_handler;

    /**
     * Handler for audio events sent by the Guacamole web-client. This handler
     * will be called whenever the web-client wishes to send a continuous
     * stream of audio data from some arbitrary source (a microphone, for
     * example).
     *
     * The handler takes a guac_stream, which contains the stream index and
     * will persist through the duration of the transfer, and the mimetype
     * of the data being transferred.
     *
     * Example:
     * @code
     *     int audio_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->audio_handler = audio_handler;
     *     }
     * @endcode
     */
    guac_user_audio_handler* audio_handler;

    /**
     * Handler for argv events (updates to the connection parameters of an
     * in-progress connection) sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, the mimetype of
     * the data being transferred, and the argument (connection parameter)
     * name.
     *
     * Example:
     * @code
     *     int argv_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype, char* name);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->argv_handler = argv_handler;
     *     }
     * @endcode
     */
    guac_user_argv_handler* argv_handler;

    /**
     * Handler for touch events sent by the Guacamole web-client.
     *
     * The handler takes the integer X and Y coordinates representing the
     * center of the touch contact, as well as several parameters describing
     * the general shape of the contact area. The force parameter indicates the
     * amount of force exerted by the contact, including whether the contact
     * has been lifted.
     *
     * Example:
     * @code
     *     int touch_handler(guac_user* user, int id, int x, int y,
     *             int x_radius, int y_radius, double angle, double force);
     *
     *     int guac_user_init(guac_user* user, int argc, char** argv) {
     *         user->touch_handler = touch_handler;
     *     }
     * @endcode
     */
    guac_user_touch_handler* touch_handler;

};

/**
 * Allocates a new, blank user, not associated with any specific client or
 * socket.
 *
 * @return The newly allocated guac_user, or NULL if allocation failed.
 */
guac_user* guac_user_alloc();

/**
 * Frees the given user and all associated resources.
 *
 * @param user The guac_user to free.
 */
void guac_user_free(guac_user* user);

/**
 * Handles all I/O for the portion of a user's Guacamole connection following
 * the initial "select" instruction, including the rest of the handshake. The
 * handshake-related properties of the given guac_user are automatically
 * populated, and guac_user_handle_instruction() is invoked for all
 * instructions received after the handshake has completed. This function
 * blocks until the connection/user is aborted or the user disconnects.
 *
 * @param user
 *     The user whose handshake and entire Guacamole protocol exchange should
 *     be handled. The user must already be associated with a guac_socket and
 *     guac_client, and the guac_client must already be fully initialized.
 *
 * @param usec_timeout
 *     The number of microseconds to wait for instructions from the given
 *     user before closing the connection with an error.
 *
 * @return
 *     Zero if the user's Guacamole connection was successfully handled and
 *     the user has disconnected, or non-zero if an error prevented the user's
 *     connection from being handled properly.
 */
int guac_user_handle_connection(guac_user* user, int usec_timeout);

/**
 * Call the appropriate handler defined by the given user for the given
 * instruction. A comparison is made between the instruction opcode and the
 * initial handler lookup table defined in user-handlers.c. The initial handlers
 * will in turn call the user's handler (if defined).
 *
 * @param user
 *     The user whose handlers should be called.
 *
 * @param opcode
 *     The opcode of the instruction to pass to the user via the appropriate
 *     handler.
 *
 * @param argc
 *     The number of arguments which are part of the instruction.
 *
 * @param argv
 *     An array of all arguments which are part of the instruction.
 *
 * @return
 *     Non-negative if the instruction was handled successfully, or negative
 *     if an error occurred.
 */
int guac_user_handle_instruction(guac_user* user, const char* opcode,
        int argc, char** argv);

/**
 * Allocates a new stream. An arbitrary index is automatically assigned
 * if no previously-allocated stream is available for use.
 *
 * @param user
 *     The user to allocate the stream for.
 *
 * @return
 *     The next available stream, or a newly allocated stream, or NULL if the
 *     maximum number of active streams has been reached.
 */
guac_stream* guac_user_alloc_stream(guac_user* user);

/**
 * Returns the given stream to the pool of available streams, such that it
 * can be reused by any subsequent call to guac_user_alloc_stream().
 *
 * @param user The user to return the stream to.
 * @param stream The stream to return to the pool of available stream.
 */
void guac_user_free_stream(guac_user* user, guac_stream* stream);

/**
 * Signals the given user that it must disconnect, or advises cooperating
 * services that the given user is no longer connected.
 *
 * @param user The user to stop.
 */
void guac_user_stop(guac_user* user);

/**
 * Signals the given user to stop gracefully, while also signalling via the
 * Guacamole protocol that an error has occurred. Note that this is a completely
 * cooperative signal, and can be ignored by the user or the hosting
 * daemon. The message given will be logged to the system logs.
 *
 * @param user The user to signal to stop.
 * @param status The status to send over the Guacamole protocol.
 * @param format A printf-style format string to log.
 * @param ... Arguments to use when filling the format string for printing.
 */
void guac_user_abort(guac_user* user, guac_protocol_status status,
        const char* format, ...);

/**
 * Signals the given user to stop gracefully, while also signalling via the
 * Guacamole protocol that an error has occurred. Note that this is a completely
 * cooperative signal, and can be ignored by the user or the hosting
 * daemon. The message given will be logged to the system logs.
 *
 * @param user The user to signal to stop.
 * @param status The status to send over the Guacamole protocol.
 * @param format A printf-style format string to log.
 * @param ap The va_list containing the arguments to be used when filling the
 *           format string for printing.
 */
void vguac_user_abort(guac_user* user, guac_protocol_status status,
        const char* format, va_list ap);

/**
 * Writes a message in the log used by the given user. The logger used will
 * normally be defined by guacd (or whichever program loads the user)
 * by setting the logging handlers of the user when it is loaded.
 *
 * @param user The user logging this message.
 * @param level The level at which to log this message.
 * @param format A printf-style format string to log.
 * @param ... Arguments to use when filling the format string for printing.
 */
void guac_user_log(guac_user* user, guac_client_log_level level,
        const char* format, ...);

/**
 * Writes a message in the log used by the given user. The logger used will
 * normally be defined by guacd (or whichever program loads the user)
 * by setting the logging handlers of the user when it is loaded.
 *
 * @param user The user logging this message.
 * @param level The level at which to log this message.
 * @param format A printf-style format string to log.
 * @param ap The va_list containing the arguments to be used when filling the
 *           format string for printing.
 */
void vguac_user_log(guac_user* user, guac_client_log_level level,
        const char* format, va_list ap);

/**
 * Allocates a new object. An arbitrary index is automatically assigned
 * if no previously-allocated object is available for use.
 *
 * @param user
 *     The user to allocate the object for.
 *
 * @return
 *     The next available object, or a newly allocated object.
 */
guac_object* guac_user_alloc_object(guac_user* user);

/**
 * Returns the given object to the pool of available objects, such that it
 * can be reused by any subsequent call to guac_user_alloc_object().
 *
 * @param user
 *     The user to return the object to.
 *
 * @param object
 *     The object to return to the pool of available object.
 */
void guac_user_free_object(guac_user* user, guac_object* object);

/**
 * Streams the given connection parameter value over an argument value stream
 * ("argv" instruction), exposing the current value of the named connection
 * parameter to the given user. The argument value stream will be automatically
 * allocated and freed.
 *
 * @param user
 *     The Guacamole user who should receive the connection parameter value.
 *
 * @param socket
 *     The socket over which instructions associated with the argument value
 *     stream should be sent.
 *
 * @param mimetype
 *     The mimetype of the data within the connection parameter value being
 *     sent.
 *
 * @param name
 *     The name of the connection parameter being sent.
 *
 * @param value
 *     The current value of the connection parameter being sent.
 */
void guac_user_stream_argv(guac_user* user, guac_socket* socket,
        const char* mimetype, const char* name, const char* value);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as PNG-encoded data. The image stream will be automatically
 * allocated and freed.
 *
 * @param user
 *     The Guacamole user for whom the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 */
void guac_user_stream_png(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as JPEG-encoded data at the given quality. The image stream
 * will be automatically allocated and freed.
 *
 * @param user
 *     The Guacamole user for whom the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 *
 * @param quality
 *     The JPEG image quality, which must be an integer value between 0 and 100
 *     inclusive. Larger values indicate improving quality at the expense of
 *     larger file size.
 */
void guac_user_stream_jpeg(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as WebP-encoded data at the given quality. The image stream
 * will be automatically allocated and freed. If the server does not support
 * WebP, this function has no effect, so be sure to check the result of
 * guac_user_supports_webp() or guac_client_supports_webp() prior to calling
 * this function.
 *
 * @param user
 *     The Guacamole user for whom the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 *
 * @param quality
 *     The WebP image quality, which must be an integer value between 0 and 100
 *     inclusive. For lossy images, larger values indicate improving quality at
 *     the expense of larger file size. For lossless images, this dictates the
 *     quality of compression, with larger values producing smaller files at
 *     the expense of speed.
 *
 * @param lossless
 *     Zero to encode a lossy image, non-zero to encode losslessly.
 */
void guac_user_stream_webp(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality, int lossless);

/**
 * Returns whether the given user supports the "msg" instruction.
 * 
 * @param user
 *     The Guacamole user to check for support of the "msg" instruction.
 * 
 * @return 
 *     Non-zero if the user supports the "msg" instruction, otherwise zero.
 */
int guac_user_supports_msg(guac_user* user);

/**
 * Returns whether the given user supports the "required" instruction.
 * 
 * @param user
 *     The Guacamole user to check for support of the "required" instruction.
 * 
 * @return 
 *     Non-zero if the user supports the "required" instruction, otherwise zero.
 */
int guac_user_supports_required(guac_user* user);

/**
 * Returns whether the given user supports WebP. If the user does not
 * support WebP, or the server cannot encode WebP images, zero is returned.
 *
 * @param user
 *     The Guacamole user to check for WebP support.
 *
 * @return
 *     Non-zero if the given user claims to support WebP and the server has
 *     been built with WebP support, zero otherwise.
 */
int guac_user_supports_webp(guac_user* user);

/**
 * Automatically handles a single argument received from a joining user,
 * returning a newly-allocated string containing that value. If the argument
 * provided by the user is blank, a newly-allocated string containing the
 * default value is returned.
 *
 * @param user
 *     The user joining the connection and providing the given arguments.
 *
 * @param arg_names
 *     A NULL-terminated array of argument names, corresponding to the provided
 *     array of argument values. This array must be exactly the same size as
 *     the argument value array, with one additional entry for the NULL
 *     terminator.
 *
 * @param argv
 *     An array of all argument values, corresponding to the provided array of
 *     argument names. This array must be exactly the same size as the argument
 *     name array, with the exception of the NULL terminator.
 *
 * @param index
 *     The index of the entry in both the arg_names and argv arrays which
 *     corresponds to the argument being parsed.
 *
 * @param default_value
 *     The value to return if the provided argument is blank. If this value is
 *     not NULL, the returned value will be a newly-allocated string containing
 *     this value.
 *
 * @return
 *     A newly-allocated string containing the provided argument value. If the
 *     provided argument value is blank, this newly-allocated string will
 *     contain the default value. If the default value is NULL and the provided
 *     argument value is blank, no string will be allocated and NULL is
 *     returned.
 */
char* guac_user_parse_args_string(guac_user* user, const char** arg_names,
        const char** argv, int index, const char* default_value);

/**
 * Automatically handles a single integer argument received from a joining
 * user, returning the integer value of that argument. If the argument provided
 * by the user is blank or invalid, the default value is returned.
 *
 * @param user
 *     The user joining the connection and providing the given arguments.
 *
 * @param arg_names
 *     A NULL-terminated array of argument names, corresponding to the provided
 *     array of argument values. This array must be exactly the same size as
 *     the argument value array, with one additional entry for the NULL
 *     terminator.
 *
 * @param argv
 *     An array of all argument values, corresponding to the provided array of
 *     argument names. This array must be exactly the same size as the argument
 *     name array, with the exception of the NULL terminator.
 *
 * @param index
 *     The index of the entry in both the arg_names and argv arrays which
 *     corresponds to the argument being parsed.
 *
 * @param default_value
 *     The value to return if the provided argument is blank or invalid.
 *
 * @return
 *     The integer value parsed from the provided argument value, or the
 *     default value if the provided argument value is blank or invalid.
 */
int guac_user_parse_args_int(guac_user* user, const char** arg_names,
        const char** argv, int index, int default_value);

/**
 * Automatically handles a single boolean argument received from a joining
 * user, returning the value of that argument (either 1 for true or 0 for
 * false). Only "true" and "false" are legitimate values for a boolean
 * argument. If the argument provided by the user is blank or invalid, the
 * default value is returned.
 *
 * @param user
 *     The user joining the connection and providing the given arguments.
 *
 * @param arg_names
 *     A NULL-terminated array of argument names, corresponding to the provided
 *     array of argument values. This array must be exactly the same size as
 *     the argument value array, with one additional entry for the NULL
 *     terminator.
 *
 * @param argv
 *     An array of all argument values, corresponding to the provided array of
 *     argument names. This array must be exactly the same size as the argument
 *     name array, with the exception of the NULL terminator.
 *
 * @param index
 *     The index of the entry in both the arg_names and argv arrays which
 *     corresponds to the argument being parsed.
 *
 * @param default_value
 *     The value to return if the provided argument is blank or invalid.
 *
 * @return
 *     true (1) if the provided argument value is "true", false (0) if the
 *     provided argument value is "false", or the default value if the provided
 *     argument value is blank or invalid.
 */
int guac_user_parse_args_boolean(guac_user* user, const char** arg_names,
        const char** argv, int index, int default_value);

#endif

