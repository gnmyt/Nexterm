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

#ifndef _GUAC_PROTOCOL_H
#define _GUAC_PROTOCOL_H

/**
 * Provides functions and structures required for communicating using the
 * Guacamole protocol over a guac_socket connection, such as that provided by
 * guac_client objects.
 *
 * @file protocol.h
 */

#include "layer-types.h"
#include "object-types.h"
#include "protocol-constants.h"
#include "protocol-types.h"
#include "socket-types.h"
#include "stream-types.h"
#include "timestamp-types.h"

#include <cairo/cairo.h>
#include <stdarg.h>

/* CONTROL INSTRUCTIONS */

/**
 * Sends an ack instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The guac_stream associated with the operation this ack is
 *               acknowledging.
 * @param error The human-readable description associated with the error or
 *              status update.
 * @param status The status code related to the error or status.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_ack(guac_socket* socket, guac_stream* stream,
        const char* error, guac_protocol_status status);

/**
 * Sends an args instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param args The NULL-terminated array of argument names (strings).
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_args(guac_socket* socket, const char** args);

/**
 * Sends a connect instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param args The NULL-terminated array of argument values (strings).
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_connect(guac_socket* socket, const char** args);

/**
 * Sends a disconnect instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_disconnect(guac_socket* socket);

/**
 * Sends an error instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param error The human-readable description associated with the error.
 * @param status The status code related to the error.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_error(guac_socket* socket, const char* error,
        guac_protocol_status status);

/**
 * Sends a key instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param keysym
 *     The X11 keysym of the key that was pressed or released.
 *
 * @param pressed
 *     Non-zero if the key represented by the given keysym is currently
 *     pressed, zero if it is released.
 *
 * @param timestamp
 *     The server timestamp (in milliseconds) at the point in time this key
 *     event was acknowledged.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_key(guac_socket* socket, int keysym, int pressed,
        guac_timestamp timestamp);

/**
 * Sends a log instruction over the given guac_socket connection. This is
 * mainly useful in debugging.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param format A printf-style format string to log.
 * @param ... Arguments to use when filling the format string for printing.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_log(guac_socket* socket, const char* format, ...);

/**
 * Sends a log instruction over the given guac_socket connection. This is
 * mainly useful in debugging.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param format
 *     A printf-style format string to log.
 *
 * @param args
 *     The va_list containing the arguments to be used when filling the
 *     format string for printing.
 *
 * @return
 *     Zero if the instruction was sent successfully, non-zero if an error
 *     occurs.
 */
int vguac_protocol_send_log(guac_socket* socket, const char* format,
        va_list args);

/**
 * Sends the given string over the socket to be displayed on the client. Returns
 * zero if the message was sent successfully or non-zero if an error occurs.
 *
 * @param socket
 *     The guac_socket connection to send the message to.
 *
 * @param msg
 *     The message code to send to the client.
 *
 * @param args
 *     A null-terminated array of strings that will be provided to the client
 *     as part of the message, that the client may then place in the message,
 *     or null if the message requires no arguments.
 *
 * @return
 *     Zero if the message is sent successfully; otherwise non-zero.
 */
int guac_protocol_send_msg(guac_socket* socket, guac_message_type msg,
        const char** args);

/**
 * Sends a mouse instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param x
 *     The X coordinate of the current mouse position.
 *
 * @param y
 *     The Y coordinate of the current mouse position.
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
 * @param timestamp
 *     The server timestamp (in milliseconds) at the point in time this mouse
 *     position was acknowledged.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_mouse(guac_socket* socket, int x, int y,
        int button_mask, guac_timestamp timestamp);

/**
 * Sends a touch instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param id
 *     An arbitrary integer ID which uniquely identifies this contact relative
 *     to other active contacts.
 *
 * @param x
 *     The X coordinate of the center of the touch contact.
 *
 * @param y
 *     The Y coordinate of the center of the touch contact.
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
 * @param timestamp
 *     The server timestamp (in milliseconds) at the point in time this touch
 *     event was acknowledged.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_touch(guac_socket* socket, int id, int x, int y,
        int x_radius, int y_radius, double angle, double force,
        guac_timestamp timestamp);

/**
 * Sends a nest instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @deprecated
 *     The "nest" instruction and the corresponding guac_socket
 *     implementation are no longer necessary, having been replaced by
 *     the streaming instructions ("blob", "ack", "end"). Code using nested
 *     sockets or the "nest" instruction should instead write to a normal
 *     socket directly.
 *
 * @param socket The guac_socket connection to use.
 * @param index The integer index of the stream to send the protocol
 *              data over.
 * @param data A string containing protocol data, which must be UTF-8
 *             encoded and null-terminated.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_nest(guac_socket* socket, int index,
        const char* data);

/**
 * Sends a nop instruction (null-operation) over the given guac_socket
 * connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_nop(guac_socket* socket);

/**
 * Sends a ready instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param id The connection ID of the connection that is ready.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_ready(guac_socket* socket, const char* id);

/**
 * Sends a set instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to set the parameter of.
 * @param name The name of the parameter to set.
 * @param value The value to set the parameter to.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_set(guac_socket* socket, const guac_layer* layer,
        const char* name, const char* value);

/**
 * Sends a set instruction over the given guac_socket connection. This function
 * behaves identically to guac_protocol_send_set() except that the provided
 * parameter value is an integer, rather than a string.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param layer
 *     The layer to set the parameter of.
 *
 * @param name
 *     The name of the parameter to set.
 *
 * @param value
 *     The value to set the parameter to.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_set_int(guac_socket* socket, const guac_layer* layer,
        const char* name, int value);

/**
 * Sends a select instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param protocol The protocol to request.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_select(guac_socket* socket, const char* protocol);

/**
 * Sends a sync instruction over the given guac_socket connection. The
 * current time in milliseconds should be passed in as the timestamp.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param timestamp
 *     The current timestamp (in milliseconds).
 *
 * @param frames
 *     The number of distinct frames that were considered or combined when
 *     generating the frame terminated by this instruction, or zero if the
 *     boundaries of relevant frames are unknown.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_sync(guac_socket* socket, guac_timestamp timestamp,
        int frames);

/* OBJECT INSTRUCTIONS */

/**
 * Sends a body instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param object
 *     The object to associated with the stream being used.
 *
 * @param stream
 *     The stream to use.
 *
 * @param mimetype
 *     The mimetype of the data being sent.
 *
 * @param name
 *     The name of the stream whose body is being sent, as requested by a "get"
 *     instruction.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_body(guac_socket* socket, const guac_object* object,
        const guac_stream* stream, const char* mimetype, const char* name);

/**
 * Sends a filesystem instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param object
 *     The object representing the filesystem being exposed.
 *
 * @param name
 *     A name describing the filesystem being exposed.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_filesystem(guac_socket* socket,
        const guac_object* object, const char* name);

/**
 * Sends an undefine instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use.
 *
 * @param object
 *     The object being undefined.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_undefine(guac_socket* socket,
        const guac_object* object);

/* MEDIA INSTRUCTIONS */

/**
 * Sends an audio instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use when sending the audio instruction.
 *
 * @param stream
 *     The stream to use for future audio data.
 *
 * @param mimetype
 *     The mimetype of the audio data which will be sent over the given stream.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_audio(guac_socket* socket, const guac_stream* stream,
        const char* mimetype);

/**
 * Sends a file instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The stream to use.
 * @param mimetype The mimetype of the data being sent.
 * @param name A name describing the file being sent.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_file(guac_socket* socket, const guac_stream* stream,
        const char* mimetype, const char* name);

/**
 * Sends a pipe instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The stream to use.
 * @param mimetype The mimetype of the data being sent.
 * @param name An arbitrary name uniquely identifying this pipe.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_pipe(guac_socket* socket, const guac_stream* stream,
        const char* mimetype, const char* name);

/**
 * Writes a block of data to the currently in-progress blob which was already
 * created.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The stream to use.
 * @param data The file data to write.
 * @param count The number of bytes within the given buffer of file data
 *              that must be written.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_blob(guac_socket* socket, const guac_stream* stream,
        const void* data, int count);

/**
 * Sends a series of blob instructions, splitting the given data across the
 * number of instructions required to ensure the size of each blob does not
 * exceed GUAC_PROTOCOL_BLOB_MAX_LENGTH. If the size of data provided is zero,
 * no blob instructions are sent.
 *
 * If an error occurs sending any blob instruction, a non-zero value is
 * returned, guac_error is set appropriately, and no further blobs are sent.
 *
 * @see GUAC_PROTOCOL_BLOB_MAX_LENGTH
 *
 * @param socket
 *     The guac_socket connection to use to send the blob instructions.
 *
 * @param stream
 *     The stream to associate with each blob sent.
 *
 * @param data
 *     The data which should be sent using the required number of blob
 *     instructions.
 *
 * @param count
 *     The number of bytes within the given buffer of data that must be
 *     written.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_blobs(guac_socket* socket, const guac_stream* stream,
        const void* data, int count);

/**
 * Sends an end instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The stream to use.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_end(guac_socket* socket, const guac_stream* stream);

/**
 * Sends a video instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use when sending the video instruction.
 *
 * @param stream
 *     The stream to use for future video data.
 *
 * @param layer
 *     The destination layer on which the streamed video should be played.
 *
 * @param mimetype
 *     The mimetype of the video data which will be sent over the given stream.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_video(guac_socket* socket, const guac_stream* stream,
        const guac_layer* layer, const char* mimetype);

/* DRAWING INSTRUCTIONS */

/**
 * Sends an arc instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @param x The X coordinate of the center of the circle containing the arc.
 * @param y The Y coordinate of the center of the circle containing the arc. 
 * @param radius The radius of the circle containing the arc.
 * @param startAngle The starting angle, in radians.
 * @param endAngle The ending angle, in radians.
 * @param negative Zero if the arc should be drawn in order of increasing
 *                 angle, non-zero otherwise.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_arc(guac_socket* socket, const guac_layer* layer,
        int x, int y, int radius, double startAngle, double endAngle,
        int negative);

/**
 * Sends a cfill instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param mode The composite mode to use.
 * @param layer The destination layer.
 * @param r The red component of the color of the rectangle.
 * @param g The green component of the color of the rectangle.
 * @param b The blue component of the color of the rectangle.
 * @param a The alpha (transparency) component of the color of the rectangle.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_cfill(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        int r, int g, int b, int a);

/**
 * Sends a clip instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to set the clipping region of.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_clip(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a close instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_close(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a copy instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param srcl The source layer.
 * @param srcx The X coordinate of the source rectangle.
 * @param srcy The Y coordinate of the source rectangle.
 * @param w The width of the source rectangle.
 * @param h The height of the source rectangle.
 * @param mode The composite mode to use.
 * @param dstl The destination layer.
 * @param dstx The X coordinate of the destination, where the source rectangle
 *             should be copied.
 * @param dsty The Y coordinate of the destination, where the source rectangle
 *             should be copied.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_copy(guac_socket* socket, 
        const guac_layer* srcl, int srcx, int srcy, int w, int h,
        guac_composite_mode mode, const guac_layer* dstl, int dstx, int dsty);

/**
 * Sends a cstroke instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param mode The composite mode to use.
 * @param layer The destination layer.
 * @param cap The style of line cap to use when drawing the stroke.
 * @param join The style of line join to use when drawing the stroke.
 * @param thickness The thickness of the stroke in pixels.
 * @param r The red component of the color of the rectangle.
 * @param g The green component of the color of the rectangle.
 * @param b The blue component of the color of the rectangle.
 * @param a The alpha (transparency) component of the color of the rectangle.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_cstroke(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        guac_line_cap_style cap, guac_line_join_style join, int thickness,
        int r, int g, int b, int a);

/**
 * Sends a cursor instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param x The X coordinate of the cursor hotspot.
 * @param y The Y coordinate of the cursor hotspot.
 * @param srcl The source layer.
 * @param srcx The X coordinate of the source rectangle.
 * @param srcy The Y coordinate of the source rectangle.
 * @param w The width of the source rectangle.
 * @param h The height of the source rectangle.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_cursor(guac_socket* socket, int x, int y,
        const guac_layer* srcl, int srcx, int srcy, int w, int h);

/**
 * Sends a curve instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @param cp1x The X coordinate of the first control point.
 * @param cp1y The Y coordinate of the first control point.
 * @param cp2x The X coordinate of the second control point.
 * @param cp2y The Y coordinate of the second control point.
 * @param x The X coordinate of the endpoint of the curve.
 * @param y The Y coordinate of the endpoint of the curve.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_curve(guac_socket* socket, const guac_layer* layer,
        int cp1x, int cp1y, int cp2x, int cp2y, int x, int y);

/**
 * Sends an identity instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_identity(guac_socket* socket, const guac_layer* layer);

/**
 * Sends an lfill instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param mode The composite mode to use.
 * @param layer The destination layer.
 * @param srcl The source layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_lfill(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        const guac_layer* srcl);

/**
 * Sends a line instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @param x The X coordinate of the endpoint of the line.
 * @param y The Y coordinate of the endpoint of the line.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_line(guac_socket* socket, const guac_layer* layer,
        int x, int y);

/**
 * Sends an lstroke instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param mode The composite mode to use.
 * @param layer The destination layer.
 * @param cap The style of line cap to use when drawing the stroke.
 * @param join The style of line join to use when drawing the stroke.
 * @param thickness The thickness of the stroke in pixels.
 * @param srcl The source layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_lstroke(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        guac_line_cap_style cap, guac_line_join_style join, int thickness,
        const guac_layer* srcl);

/**
 * Sends an img instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use when sending the img instruction.
 *
 * @param stream
 *     The stream over which the image data will be sent.
 *
 * @param mode
 *     The composite mode to use when drawing the image over the destination
 *     layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param mimetype
 *     The mimetype of the image data being sent.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the destination layer, in pixels.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the destination layer, in pixels.
 *
 * @return
 *     Zero if the instruction was successfully sent, non-zero on error.
 */
int guac_protocol_send_img(guac_socket* socket, const guac_stream* stream,
        guac_composite_mode mode, const guac_layer* layer,
        const char* mimetype, int x, int y);

/**
 * Sends a pop instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to set the clipping region of.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_pop(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a push instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to set the clipping region of.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_push(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a rect instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @param x The X coordinate of the rectangle.
 * @param y The Y coordinate of the rectangle.
 * @param width The width of the rectangle.
 * @param height The height of the rectangle.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_rect(guac_socket* socket, const guac_layer* layer,
        int x, int y, int width, int height);

/**
 * Sends a "required" instruction over the given guac_socket connection.  This
 * instruction indicates to the client that one or more additional parameters
 * are needed to continue the connection.
 * 
 * @param socket
 *     The guac_socket connection to which to send the instruction.
 * 
 * @param required
 *     A NULL-terminated array of required parameters.
 * 
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_required(guac_socket* socket, const char** required);

/**
 * Sends a reset instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to set the clipping region of.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_reset(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a start instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The destination layer.
 * @param x The X coordinate of the first point of the subpath.
 * @param y The Y coordinate of the first point of the subpath.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_start(guac_socket* socket, const guac_layer* layer,
        int x, int y);

/**
 * Sends a transfer instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param srcl The source layer.
 * @param srcx The X coordinate of the source rectangle.
 * @param srcy The Y coordinate of the source rectangle.
 * @param w The width of the source rectangle.
 * @param h The height of the source rectangle.
 * @param fn The transfer function to use.
 * @param dstl The destination layer.
 * @param dstx The X coordinate of the destination, where the source rectangle
 *             should be copied.
 * @param dsty The Y coordinate of the destination, where the source rectangle
 *             should be copied.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_transfer(guac_socket* socket, 
        const guac_layer* srcl, int srcx, int srcy, int w, int h,
        guac_transfer_function fn, const guac_layer* dstl, int dstx, int dsty);

/**
 * Sends a transform instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to apply the given transform matrix to.
 * @param a The first value of the affine transform matrix.
 * @param b The second value of the affine transform matrix.
 * @param c The third value of the affine transform matrix.
 * @param d The fourth value of the affine transform matrix.
 * @param e The fifth value of the affine transform matrix.
 * @param f The sixth value of the affine transform matrix.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_transform(guac_socket* socket, 
        const guac_layer* layer,
        double a, double b, double c,
        double d, double e, double f);

/* LAYER INSTRUCTIONS */

/**
 * Sends a dispose instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to dispose.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_dispose(guac_socket* socket, const guac_layer* layer);

/**
 * Sends a distort instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to distort with the given transform matrix.
 * @param a The first value of the affine transform matrix.
 * @param b The second value of the affine transform matrix.
 * @param c The third value of the affine transform matrix.
 * @param d The fourth value of the affine transform matrix.
 * @param e The fifth value of the affine transform matrix.
 * @param f The sixth value of the affine transform matrix.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_distort(guac_socket* socket, 
        const guac_layer* layer,
        double a, double b, double c,
        double d, double e, double f);

/**
 * Sends a move instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to move.
 * @param parent The parent layer the specified layer will be positioned
 *               relative to.
 * @param x The X coordinate of the layer.
 * @param y The Y coordinate of the layer.
 * @param z The Z index of the layer, relative to other layers in its parent.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_move(guac_socket* socket, const guac_layer* layer,
        const guac_layer* parent, int x, int y, int z);

/**
 * Sends a shade instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to shade.
 * @param a The alpha value of the layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_shade(guac_socket* socket, const guac_layer* layer,
        int a);

/**
 * Sends a size instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param layer The layer to resize.
 * @param w The new width of the layer.
 * @param h The new height of the layer.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_size(guac_socket* socket, const guac_layer* layer,
        int w, int h);

/* TEXT INSTRUCTIONS */

/**
 * Sends an argv instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket
 *     The guac_socket connection to use to send the connection parameter
 *     value.
 *
 * @param stream
 *     The stream to use to send the connection parameter value.
 *
 * @param mimetype
 *     The mimetype of the connection parameter value being sent.
 *
 * @param name
 *     The name of the connection parameter whose current value is being sent.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_protocol_send_argv(guac_socket* socket, guac_stream* stream,
        const char* mimetype, const char* name);

/**
 * Sends a clipboard instruction over the given guac_socket connection.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param socket The guac_socket connection to use.
 * @param stream The stream to use.
 * @param mimetype The mimetype of the clipboard data being sent.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_clipboard(guac_socket* socket, const guac_stream* stream,
        const char* mimetype);

/**
 * Sends a name instruction over the given guac_socket connection.
 *
 * @param socket The guac_socket connection to use.
 * @param name The name to send within the name instruction.
 * @return Zero on success, non-zero on error.
 */
int guac_protocol_send_name(guac_socket* socket, const char* name);

/**
 * Decodes the given base64-encoded string in-place. The base64 string must
 * be NULL-terminated.
 *
 * @param base64 The base64-encoded string to decode.
 * @return The number of bytes resulting from the decode operation.
 */
int guac_protocol_decode_base64(char* base64);

/**
 * Given a string representation of a protocol version, return the enum value of
 * that protocol version, or GUAC_PROTOCOL_VERSION_UNKNOWN if the value is not a
 * known version.
 * 
 * @param version_string
 *     The string representation of the protocol version.
 * 
 * @return 
 *     The enum value of the protocol version, or GUAC_PROTOCOL_VERSION_UNKNOWN
 *     if the provided version is not known.
 */
guac_protocol_version guac_protocol_string_to_version(const char* version_string);

/**
 * Given the enum value of the protocol version, return a pointer to the string
 * representation of the version, or NULL if the version is unknown.
 * 
 * @param version
 *     The enum value of the protocol version.
 * 
 * @return 
 *     A pointer to the string representation of the protocol version, or NULL
 *     if the version is unknown.
 */
const char* guac_protocol_version_to_string(guac_protocol_version version);

#endif

