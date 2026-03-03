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

#ifndef _GUAC_USER_FNTYPES_H
#define _GUAC_USER_FNTYPES_H

/**
 * Function type definitions related to the guac_user object.
 *
 * @file user-fntypes.h
 */

#include "object-types.h"
#include "protocol-types.h"
#include "stream-types.h"
#include "timestamp-types.h"
#include "user-types.h"

/**
 * Callback which relates to a single guac_user at a time, along with arbitrary
 * data.
 *
 * @see guac_client_foreach_user()
 * @see guac_client_for_owner()
 *
 * @param user
 *     The user for which this callback was invoked. Depending on whether
 *     guac_client_foreach_user() or guac_client_for_owner() was called, this
 *     will either be the current user as the "foreach" iteration continues,
 *     or the owner of the connection. If guac_client_for_owner() was called
 *     for a connection which has no owner, this may be NULL.
 *
 * @param data
 *     The arbitrary data passed to guac_client_foreach_user() or
 *     guac_client_for_owner().
 *
 * @return
 *     An arbitrary return value, the semantics of which are determined by the
 *     implementation of the callback and the manner of its user. In the case
 *     of a callback provided to guac_client_foreach_user(), this value is
 *     always discarded.
 */
typedef void* guac_user_callback(guac_user* user, void* data);

/**
 * Handler for Guacamole mouse events, invoked when a "mouse" instruction has
 * been received from a user.
 *
 * @param user
 *     The user that sent the mouse event.
 *
 * @param x
 *     The X coordinate of the mouse within the display when the event
 *     occurred, in pixels. This value is not guaranteed to be within the
 *     bounds of the display area.
 *
 * @param y
 *     The Y coordinate of the mouse within the display when the event
 *     occurred, in pixels. This value is not guaranteed to be within the
 *     bounds of the display area.
 *
 * @param button_mask
 *     An integer value representing the current state of each button, where
 *     the Nth bit within the integer is set to 1 if and only if the Nth mouse
 *     button is currently pressed. The lowest-order bit is the left mouse
 *     button, followed by the middle button, right button, and finally the up
 *     and down buttons of the scroll wheel.
 *
 *     @see GUAC_CLIENT_MOUSE_LEFT
 *     @see GUAC_CLIENT_MOUSE_MIDDLE
 *     @see GUAC_CLIENT_MOUSE_RIGHT
 *     @see GUAC_CLIENT_MOUSE_SCROLL_UP
 *     @see GUAC_CLIENT_MOUSE_SCROLL_DOWN
 *
 * @return
 *     Zero if the mouse event was handled successfully, or non-zero if an
 *     error occurred.
 */
typedef int guac_user_mouse_handler(guac_user* user, int x, int y,
        int button_mask);

/**
 * Handler for Guacamole touch events, invoked when a "touch" instruction has
 * been received from a user.
 *
 * @param user
 *     The user that sent the touch event.
 *
 * @param id
 *     An arbitrary integer ID which uniquely identifies this contact relative
 *     to other active contacts.
 *
 * @param x
 *     The X coordinate of the center of the touch contact within the display
 *     when the event occurred, in pixels. This value is not guaranteed to be
 *     within the bounds of the display area.
 *
 * @param y
 *     The Y coordinate of the center of the touch contact within the display
 *     when the event occurred, in pixels. This value is not guaranteed to be
 *     within the bounds of the display area.
 *
 * @param x_radius
 *     The X radius of the ellipse covering the general area of the touch
 *     contact, in pixels.
 *
 * @param y_radius
 *     The Y radius of the ellipse covering the general area of the touch
 *     contact, in pixels.
 *
 * @param angle
 *     The rough angle of clockwise rotation of the general area of the touch
 *     contact, in degrees.
 *
 * @param force
 *     The relative force exerted by the touch contact, where 0 is no force
 *     (the touch has been lifted) and 1 is maximum force (the maximum amount
 *     of force representable by the device).
 *
 * @return
 *     Zero if the touch event was handled successfully, or non-zero if an
 *     error occurred.
 */
typedef int guac_user_touch_handler(guac_user* user, int id, int x, int y,
        int x_radius, int y_radius, double angle, double force);

/**
 * Handler for Guacamole key events, invoked when a "key" event has been
 * received from a user.
 *
 * @param user
 *     The user that sent the key event.
 *
 * @param keysym
 *     The X11 keysym of the key that was pressed or released.
 *
 * @param pressed
 *     Non-zero if the key represented by the given keysym is currently
 *     pressed, zero if it is released.
 *
 * @return
 *     Zero if the key event was handled successfully, or non-zero if an error
 *     occurred.
 */
typedef int guac_user_key_handler(guac_user* user, int keysym, int pressed);

/**
 * Handler for key events with XT scancode for QEMU Extended Key Event support.
 */
typedef int guac_user_key_handler_ext(guac_user* user, int keysym, int pressed,
        int scancode);

/**
 * Handler for Guacamole audio streams received from a user. Each such audio
 * stream begins when the user sends an "audio" instruction. To handle received
 * data along this stream, implementations of this handler must assign blob and
 * end handlers to the given stream object.
 *
 * @param user
 *     The user that opened the audio stream.
 *
 * @param stream
 *     The stream object allocated by libguac to represent the audio stream
 *     opened by the user.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @return
 *     Zero if the opening of the audio stream has been handled successfully,
 *     or non-zero if an error occurs.
 */
typedef int guac_user_audio_handler(guac_user* user, guac_stream* stream,
        char* mimetype);

/**
 * Handler for Guacamole clipboard streams received from a user. Each such
 * clipboard stream begins when the user sends a "clipboard" instruction. To
 * handle received data along this stream, implementations of this handler
 * must assign blob and end handlers to the given stream object.
 *
 * @param user
 *     The user that opened the clipboard stream.
 *
 * @param stream
 *     The stream object allocated by libguac to represent the clipboard stream
 *     opened by the user.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @return
 *     Zero if the opening of the clipboard stream has been handled
 *     successfully, or non-zero if an error occurs.
 */
typedef int guac_user_clipboard_handler(guac_user* user, guac_stream* stream,
        char* mimetype);

/**
 * Handler for Guacamole size events, invoked when a "size" instruction has
 * been received from a user. A "size" instruction indicates that the desired
 * display size has changed.
 *
 * @param user
 *     The user whose desired display size has changed.
 *
 * @param width
 *     The desired width of the display, in pixels.
 *
 * @param height
 *     The desired height of the display, in pixels.
 *
 * @return
 *     Zero if the size event has been successfully handled, non-zero
 *     otherwise.
 */
typedef int guac_user_size_handler(guac_user* user,
        int width, int height);

/**
 * Handler for Guacamole file streams received from a user. Each such file
 * stream begins when the user sends a "file" instruction. To handle received
 * data along this stream, implementations of this handler must assign blob and
 * end handlers to the given stream object.
 *
 * @param user
 *     The user that opened the file stream.
 *
 * @param stream
 *     The stream object allocated by libguac to represent the file stream
 *     opened by the user.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @param filename
 *     The name of the file being transferred.
 *
 * @return
 *     Zero if the opening of the file stream has been handled successfully, or
 *     non-zero if an error occurs.
 */
typedef int guac_user_file_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* filename);

/**
 * Handler for Guacamole pipe streams received from a user. Pipe streams are
 * unidirectional, arbitrary, named pipes. Each such pipe stream begins when
 * the user sends a "pipe" instruction. To handle received data along this
 * stream, implementations of this handler must assign blob and end handlers to
 * the given stream object.
 *
 * @param user
 *     The user that opened the pipe stream.
 *
 * @param stream
 *     The stream object allocated by libguac to represent the pipe stream
 *     opened by the user.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @param name
 *     The arbitrary name assigned to this pipe. It is up to the implementation
 *     of this handler and the application containing the Guacamole client to
 *     determine the semantics of a pipe stream having this name.
 *
 * @return
 *     Zero if the opening of the pipe stream has been handled successfully, or
 *     non-zero if an error occurs.
 */
typedef int guac_user_pipe_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* name);

/**
 * Handler for Guacamole argument value (argv) streams received from a user.
 * Argument value streams are real-time revisions to the connection parameters
 * of an in-progress connection. Each such argument value stream begins when
 * the user sends a "argv" instruction. To handle received data along this
 * stream, implementations of this handler must assign blob and end handlers to
 * the given stream object.
 *
 * @param user
 *     The user that opened the argument value stream.
 *
 * @param stream
 *     The stream object allocated by libguac to represent the argument value
 *     stream opened by the user.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @param name
 *     The name of the connection parameter being updated. It is up to the
 *     implementation of this handler to decide whether and how to update a
 *     connection parameter.
 *
 * @return
 *     Zero if the opening of the argument value stream has been handled
 *     successfully, or non-zero if an error occurs.
 */
typedef int guac_user_argv_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* name);

/**
 * Handler for Guacamole stream blobs. Each blob originates from a "blob"
 * instruction which was associated with a previously-created stream.
 *
 * @param user
 *     The user that is sending this blob of data along the stream.
 *
 * @param stream
 *     The stream along which the blob was received. The semantics associated
 *     with this stream are determined by the manner of its creation.
 *
 * @param data
 *     The blob of data received.
 *
 * @param length
 *     The number of bytes within the blob of data received.
 *
 * @return
 *     Zero if the blob of data was successfully handled, non-zero otherwise.
 */
typedef int guac_user_blob_handler(guac_user* user, guac_stream* stream,
        void* data, int length);

/**
 * Handler for Guacamole stream "ack" instructions. A user will send "ack"
 * instructions to acknowledge the successful receipt of blobs along a stream
 * opened by the server, or to notify of errors. An "ack" with an error status
 * implicitly closes the stream.
 *
 * @param user
 *     The user sending the "ack" instruction.
 *
 * @param stream
 *     The stream for which the "ack" was received.
 *
 * @param error
 *     An arbitrary, human-readable message describing the error that
 *     occurred, if any. If no error occurs, this will likely be blank,
 *     "SUCCESS", or similar. This value exists for the sake of readability,
 *     not for the sake of data interchange.
 *
 * @param status
 *     GUAC_PROTOCOL_STATUS_SUCCESS if the blob was received and handled
 *     successfully, or a different status code describing the problem if an
 *     error occurred and the stream has been implicitly closed.
 *
 * @return
 *     Zero if the "ack" message was successfully handled, non-zero otherwise.
 */
typedef int guac_user_ack_handler(guac_user* user, guac_stream* stream,
        char* error, guac_protocol_status status);

/**
 * Handler for Guacamole stream "end" instructions. End instructions are sent
 * by the user when a stream is closing because its end has been reached.
 *
 * @param user
 *     The user that sent the "end" instruction.
 *
 * @param stream
 *     The stream that is being closed.
 *
 * @return
 *     Zero if the end-of-stream condition has been successfully handled,
 *     non-zero otherwise.
 */
typedef int guac_user_end_handler(guac_user* user, guac_stream* stream);

/**
 * Handler for Guacamole join events. A join event is fired by the
 * guac_client whenever a guac_user joins the connection. There is no
 * instruction associated with a join event.
 *
 * Implementations of the join handler MUST NOT use the client-level
 * broadcast socket, nor invoke guac_client_foreach_user() or
 * guac_client_for_owner(). Doing so will result in undefined behavior,
 * including segfaults.
 *
 * @param user
 *     The user joining the connection. The guac_client associated with the
 *     connection will already be populated within the user object.
 *
 * @param argc
 *     The number of arguments stored within argv.
 *
 * @param argv
 *     An array of all arguments provided by the user when they joined. These
 *     arguments must correspond to the argument names declared when the
 *     guac_client was initialized. If the number of arguments does not match
 *     the number of argument names declared, then the joining user has
 *     violated the Guacamole protocol.
 *
 * @return
 *     Zero if the user has been successfully initialized and should be allowed
 *     to join the connection, non-zero otherwise.
 */
typedef int guac_user_join_handler(guac_user* user, int argc, char** argv);

/**
 * Handler for Guacamole leave events. A leave event is fired by the
 * guac_client whenever a guac_user leaves the connection. There is no
 * instruction associated with a leave event.
 *
 * Implementations of the leave handler MUST NOT use the client-level
 * broadcast socket, nor invoke guac_client_foreach_user() or
 * guac_client_for_owner(). Doing so will result in undefined behavior,
 * including segfaults.
 *
 * @param user
 *     The user that has left the connection.
 *
 * @return
 *     Zero if the leave event has been successfully handled, non-zero
 *     otherwise.
 */
typedef int guac_user_leave_handler(guac_user* user);

/**
 * Handler for Guacamole sync events. A sync event is fired by the
 * guac_client whenever a guac_user responds to a "sync" instruction. Sync
 * instructions are sent by the Guacamole server to mark the logical end of a
 * frame, and to inform the Guacamole client that all data up to a particular
 * point in time has been sent. The response from the Guacamole client
 * similarly indicates that all data received up to a particular point in
 * server time has been handled.
 *
 * @param user
 *     The user that sent the "sync" instruction.
 *
 * @param timestamp
 *     The timestamp contained within the sync instruction.
 *
 * @return
 *     Zero if the sync event has been handled successfully, non-zero
 *     otherwise.
 */
typedef int guac_user_sync_handler(guac_user* user, guac_timestamp timestamp);

/**
 * Handler for Guacamole object get requests. The semantics of the stream
 * which will be created in response to the request are determined by the type
 * of the object and the name of the stream requested. It is up to the
 * implementation of this handler to then respond with a "body" instruction
 * that begins the requested stream.
 *
 * @param user
 *     The user requesting read access to the stream having the given name.
 *
 * @param object
 *     The object from which the given named stream is being requested.
 *
 * @param name
 *     The name of the stream being requested.
 *
 * @return
 *     Zero if the get request was successfully handled, non-zero otherwise.
 */
typedef int guac_user_get_handler(guac_user* user, guac_object* object,
        char* name);

/**
 * Handler for Guacamole object put requests. Put requests implicitly create a
 * stream, the semantics of which are determined by the type of the object
 * and the name of the stream requested.
 *
 * @param user
 *     The user requesting write access to the stream having the given name.
 *
 * @param object
 *     The object from which the given named stream is being requested.
 *
 * @param stream
 *     The stream along which the blobs which should be written to the named
 *     stream will be received.
 *
 * @param mimetype
 *     The mimetype of the data that will be received along the given stream.
 *
 * @param name
 *     The name of the stream being requested.
 *
 * @return
 *     Zero if the put request was successfully handled, non-zero otherwise.
 */
typedef int guac_user_put_handler(guac_user* user, guac_object* object,
        guac_stream* stream, char* mimetype, char* name);

#endif

