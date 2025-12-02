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

var Guacamole = Guacamole || {};

/**
 * Guacamole protocol client. Given a {@link Guacamole.Tunnel},
 * automatically handles incoming and outgoing Guacamole instructions via the
 * provided tunnel, updating its display using one or more canvas elements.
 * 
 * @constructor
 * @param {!Guacamole.Tunnel} tunnel
 *     The tunnel to use to send and receive Guacamole instructions.
 */
Guacamole.Client = function(tunnel) {

    var guac_client = this;

    var currentState = Guacamole.Client.State.IDLE;
    
    var currentTimestamp = 0;

    /**
     * The rough number of milliseconds to wait between sending keep-alive
     * pings. This may vary depending on how frequently the browser allows
     * timers to run, as well as how frequently the client receives messages
     * from the server.
     *
     * @private
     * @constant
     * @type {!number}
     */
    var KEEP_ALIVE_FREQUENCY = 5000;

    /**
     * The current keep-alive ping timeout ID, if any. This will only be set
     * upon connecting.
     *
     * @private
     * @type {number}
     */
    var keepAliveTimeout = null;

    /**
     * The timestamp of the point in time that the last keep-live ping was
     * sent, in milliseconds elapsed since midnight of January 1, 1970 UTC.
     *
     * @private
     * @type {!number}
     */
    var lastSentKeepAlive = 0;

    /**
     * Translation from Guacamole protocol line caps to Layer line caps.
     *
     * @private
     * @type {!Object.<number, string>}
     */
    var lineCap = {
        0: "butt",
        1: "round",
        2: "square"
    };

    /**
     * Translation from Guacamole protocol line caps to Layer line caps.
     *
     * @private
     * @type {!Object.<number, string>}
     */
    var lineJoin = {
        0: "bevel",
        1: "miter",
        2: "round"
    };

    /**
     * The underlying Guacamole display.
     *
     * @private
     * @type {!Guacamole.Display}
     */
    var display = new Guacamole.Display();

    /**
     * All available layers and buffers
     *
     * @private
     * @type {!Object.<number, (Guacamole.Display.VisibleLayer|Guacamole.Layer)>}
     */
    var layers = {};
    
    /**
     * All audio players currently in use by the client. Initially, this will
     * be empty, but audio players may be allocated by the server upon request.
     *
     * @private
     * @type {!Object.<number, Guacamole.AudioPlayer>}
     */
    var audioPlayers = {};

    /**
     * All video players currently in use by the client. Initially, this will
     * be empty, but video players may be allocated by the server upon request.
     *
     * @private
     * @type {!Object.<number, Guacamole.VideoPlayer>}
     */
    var videoPlayers = {};

    // No initial parsers
    var parsers = [];

    // No initial streams 
    var streams = [];

    /**
     * All current objects. The index of each object is dictated by the
     * Guacamole server.
     *
     * @private
     * @type {!Guacamole.Object[]}
     */
    var objects = [];

    // Pool of available stream indices
    var stream_indices = new Guacamole.IntegerPool();

    // Array of allocated output streams by index
    var output_streams = [];

    function setState(state) {
        if (state != currentState) {
            currentState = state;
            if (guac_client.onstatechange)
                guac_client.onstatechange(currentState);
        }
    }

    function isConnected() {
        return currentState == Guacamole.Client.State.CONNECTED
            || currentState == Guacamole.Client.State.WAITING;
    }

    /**
     * Produces an opaque representation of Guacamole.Client state which can be
     * later imported through a call to importState(). This object is
     * effectively an independent, compressed snapshot of protocol and display
     * state. Invoking this function implicitly flushes the display.
     *
     * @param {!function} callback
     *     Callback which should be invoked once the state object is ready. The
     *     state object will be passed to the callback as the sole parameter.
     *     This callback may be invoked immediately, or later as the display
     *     finishes rendering and becomes ready.
     */
    this.exportState = function exportState(callback) {

        // Start with empty state
        var state = {
            'currentState' : currentState,
            'currentTimestamp' : currentTimestamp,
            'layers' : {}
        };

        var layersSnapshot = {};

        // Make a copy of all current layers (protocol state)
        for (var key in layers) {
            layersSnapshot[key] = layers[key];
        }

        // Populate layers once data is available (display state, requires flush)
        display.flush(function populateLayers() {

            // Export each defined layer/buffer
            for (var key in layersSnapshot) {

                var index = parseInt(key);
                var layer = layersSnapshot[key];
                var canvas = layer.toCanvas();

                // Store layer/buffer dimensions
                var exportLayer = {
                    'width'  : layer.width,
                    'height' : layer.height
                };

                // Store layer/buffer image data, if it can be generated
                if (layer.width && layer.height)
                    exportLayer.url = canvas.toDataURL('image/png');

                // Add layer properties if not a buffer nor the default layer
                if (index > 0) {
                    exportLayer.x = layer.x;
                    exportLayer.y = layer.y;
                    exportLayer.z = layer.z;
                    exportLayer.alpha = layer.alpha;
                    exportLayer.matrix = layer.matrix;
                    exportLayer.parent = getLayerIndex(layer.parent);
                }

                // Store exported layer
                state.layers[key] = exportLayer;

            }

            // Invoke callback now that the state is ready
            callback(state);

        });

    };

    /**
     * Restores Guacamole.Client protocol and display state based on an opaque
     * object from a prior call to exportState(). The Guacamole.Client instance
     * used to export that state need not be the same as this instance.
     *
     * @param {!object} state
     *     An opaque representation of Guacamole.Client state from a prior call
     *     to exportState().
     *
     * @param {function} [callback]
     *     The function to invoke when state has finished being imported. This
     *     may happen immediately, or later as images within the provided state
     *     object are loaded.
     */
    this.importState = function importState(state, callback) {

        var key;
        var index;

        currentState = state.currentState;
        currentTimestamp = state.currentTimestamp;

        // Cancel any pending display operations/frames
        display.cancel();

        // Dispose of all layers
        for (key in layers) {
            index = parseInt(key);
            if (index > 0)
                layers[key].dispose();
        }

        layers = {};

        // Import state of each layer/buffer
        for (key in state.layers) {

            index = parseInt(key);

            var importLayer = state.layers[key];
            var layer = getLayer(index);

            // Reset layer size
            display.resize(layer, importLayer.width, importLayer.height);

            // Initialize new layer if it has associated data
            if (importLayer.url) {
                display.setChannelMask(layer, Guacamole.Layer.SRC);
                display.draw(layer, 0, 0, importLayer.url);
            }

            // Set layer-specific properties if not a buffer nor the default layer
            if (index > 0 && importLayer.parent >= 0) {

                // Apply layer position and set parent
                var parent = getLayer(importLayer.parent);
                display.move(layer, parent, importLayer.x, importLayer.y, importLayer.z);

                // Set layer transparency
                display.shade(layer, importLayer.alpha);

                // Apply matrix transform
                var matrix = importLayer.matrix;
                display.distort(layer,
                    matrix[0], matrix[1], matrix[2],
                    matrix[3], matrix[4], matrix[5]);

            }

        }

        // Flush changes to display
        display.flush(callback);

    };

    /**
     * Returns the underlying display of this Guacamole.Client. The display
     * contains an Element which can be added to the DOM, causing the
     * display to become visible.
     * 
     * @return {!Guacamole.Display}
     *     The underlying display of this Guacamole.Client.
     */
    this.getDisplay = function() {
        return display;
    };

    /**
     * Sends the current size of the screen.
     * 
     * @param {!number} width
     *     The width of the screen.
     *
     * @param {!number} height
     *     The height of the screen.
     */
    this.sendSize = function(width, height) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        tunnel.sendMessage("size", width, height);

    };

    /**
     * Sends a key event having the given properties as if the user
     * pressed or released a key.
     * 
     * @param {!boolean} pressed
     *     Whether the key is pressed (true) or released (false).
     *
     * @param {!number} keysym
     *     The keysym of the key being pressed or released.
     */
    this.sendKeyEvent = function(pressed, keysym) {
        // Do not send requests if not connected
        if (!isConnected())
            return;

        tunnel.sendMessage("key", keysym, pressed);
    };

    /**
     * Sends a mouse event having the properties provided by the given mouse
     * state.
     * 
     * @param {!Guacamole.Mouse.State} mouseState
     *     The state of the mouse to send in the mouse event.
     *
     * @param {boolean} [applyDisplayScale=false]
     *     Whether the provided mouse state uses local display units, rather
     *     than remote display units, and should be scaled to match the
     *     {@link Guacamole.Display}.
     */
    this.sendMouseState = function sendMouseState(mouseState, applyDisplayScale) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        var x = mouseState.x;
        var y = mouseState.y;

        // Translate for display units if requested
        if (applyDisplayScale) {
            x /= display.getScale();
            y /= display.getScale();
        }

        // Update client-side cursor
        display.moveCursor(
            Math.floor(x),
            Math.floor(y)
        );

        // Build mask
        var buttonMask = 0;
        if (mouseState.left)   buttonMask |= 1;
        if (mouseState.middle) buttonMask |= 2;
        if (mouseState.right)  buttonMask |= 4;
        if (mouseState.up)     buttonMask |= 8;
        if (mouseState.down)   buttonMask |= 16;

        // Send message
        tunnel.sendMessage("mouse", Math.floor(x), Math.floor(y), buttonMask);
    };

    /**
     * Sends a touch event having the properties provided by the given touch
     * state.
     *
     * @param {!Guacamole.Touch.State} touchState
     *     The state of the touch contact to send in the touch event.
     *
     * @param {boolean} [applyDisplayScale=false]
     *     Whether the provided touch state uses local display units, rather
     *     than remote display units, and should be scaled to match the
     *     {@link Guacamole.Display}.
     */
    this.sendTouchState = function sendTouchState(touchState, applyDisplayScale) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        var x = touchState.x;
        var y = touchState.y;

        // Translate for display units if requested
        if (applyDisplayScale) {
            x /= display.getScale();
            y /= display.getScale();
        }

        tunnel.sendMessage('touch', touchState.id, Math.floor(x), Math.floor(y),
            Math.floor(touchState.radiusX), Math.floor(touchState.radiusY),
            touchState.angle, touchState.force);

    };

    /**
     * Allocates an available stream index and creates a new
     * Guacamole.OutputStream using that index, associating the resulting
     * stream with this Guacamole.Client. Note that this stream will not yet
     * exist as far as the other end of the Guacamole connection is concerned.
     * Streams exist within the Guacamole protocol only when referenced by an
     * instruction which creates the stream, such as a "clipboard", "file", or
     * "pipe" instruction.
     *
     * @returns {!Guacamole.OutputStream}
     *     A new Guacamole.OutputStream with a newly-allocated index and
     *     associated with this Guacamole.Client.
     */
    this.createOutputStream = function createOutputStream() {

        // Allocate index
        var index = stream_indices.next();

        // Return new stream
        var stream = output_streams[index] = new Guacamole.OutputStream(guac_client, index);
        return stream;

    };

    /**
     * Opens a new audio stream for writing, where audio data having the give
     * mimetype will be sent along the returned stream. The instruction
     * necessary to create this stream will automatically be sent.
     *
     * @param {!string} mimetype
     *     The mimetype of the audio data that will be sent along the returned
     *     stream.
     *
     * @return {!Guacamole.OutputStream}
     *     The created audio stream.
     */
    this.createAudioStream = function(mimetype) {

        // Allocate and associate stream with audio metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("audio", stream.index, mimetype);
        return stream;

    };

    /**
     * Opens a new file for writing, having the given index, mimetype and
     * filename. The instruction necessary to create this stream will
     * automatically be sent.
     *
     * @param {!string} mimetype
     *     The mimetype of the file being sent.
     *
     * @param {!string} filename
     *     The filename of the file being sent.
     *
     * @return {!Guacamole.OutputStream}
     *     The created file stream.
     */
    this.createFileStream = function(mimetype, filename) {

        // Allocate and associate stream with file metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("file", stream.index, mimetype, filename);
        return stream;

    };

    /**
     * Opens a new pipe for writing, having the given name and mimetype. The
     * instruction necessary to create this stream will automatically be sent.
     *
     * @param {!string} mimetype
     *     The mimetype of the data being sent.
     *
     * @param {!string} name
     *     The name of the pipe.
     *
     * @return {!Guacamole.OutputStream}
     *     The created file stream.
     */
    this.createPipeStream = function(mimetype, name) {

        // Allocate and associate stream with pipe metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("pipe", stream.index, mimetype, name);
        return stream;

    };

    /**
     * Opens a new clipboard object for writing, having the given mimetype. The
     * instruction necessary to create this stream will automatically be sent.
     *
     * @param {!string} mimetype
     *     The mimetype of the data being sent.
     *
     * @param {!string} name
     *     The name of the pipe.
     *
     * @return {!Guacamole.OutputStream}
     *     The created file stream.
     */
    this.createClipboardStream = function(mimetype) {

        // Allocate and associate stream with clipboard metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("clipboard", stream.index, mimetype);
        return stream;

    };

    /**
     * Opens a new argument value stream for writing, having the given
     * parameter name and mimetype, requesting that the connection parameter
     * with the given name be updated to the value described by the contents
     * of the following stream. The instruction necessary to create this stream
     * will automatically be sent.
     *
     * @param {!string} mimetype
     *     The mimetype of the data being sent.
     *
     * @param {!string} name
     *     The name of the connection parameter to attempt to update.
     *
     * @return {!Guacamole.OutputStream}
     *     The created argument value stream.
     */
    this.createArgumentValueStream = function createArgumentValueStream(mimetype, name) {

        // Allocate and associate stream with argument value metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("argv", stream.index, mimetype, name);
        return stream;

    };

    /**
     * Creates a new output stream associated with the given object and having
     * the given mimetype and name. The legality of a mimetype and name is
     * dictated by the object itself. The instruction necessary to create this
     * stream will automatically be sent.
     *
     * @param {!number} index
     *     The index of the object for which the output stream is being
     *     created.
     *
     * @param {!string} mimetype
     *     The mimetype of the data which will be sent to the output stream.
     *
     * @param {!string} name
     *     The defined name of an output stream within the given object.
     *
     * @returns {!Guacamole.OutputStream}
     *     An output stream which will write blobs to the named output stream
     *     of the given object.
     */
    this.createObjectOutputStream = function createObjectOutputStream(index, mimetype, name) {

        // Allocate and associate stream with object metadata
        var stream = guac_client.createOutputStream();
        tunnel.sendMessage("put", index, stream.index, mimetype, name);
        return stream;

    };

    /**
     * Requests read access to the input stream having the given name. If
     * successful, a new input stream will be created.
     *
     * @param {!number} index
     *     The index of the object from which the input stream is being
     *     requested.
     *
     * @param {!string} name
     *     The name of the input stream to request.
     */
    this.requestObjectInputStream = function requestObjectInputStream(index, name) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        tunnel.sendMessage("get", index, name);
    };

    /**
     * Acknowledge receipt of a blob on the stream with the given index.
     * 
     * @param {!number} index
     *     The index of the stream associated with the received blob.
     *
     * @param {!string} message
     *     A human-readable message describing the error or status.
     *
     * @param {!number} code
     *     The error code, if any, or 0 for success.
     */
    this.sendAck = function(index, message, code) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        tunnel.sendMessage("ack", index, message, code);
    };

    /**
     * Given the index of a file, writes a blob of data to that file.
     * 
     * @param {!number} index
     *     The index of the file to write to.
     *
     * @param {!string} data
     *     Base64-encoded data to write to the file.
     */
    this.sendBlob = function(index, data) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        tunnel.sendMessage("blob", index, data);
    };

    /**
     * Marks a currently-open stream as complete. The other end of the
     * Guacamole connection will be notified via an "end" instruction that the
     * stream is closed, and the index will be made available for reuse in
     * future streams.
     * 
     * @param {!number} index
     *     The index of the stream to end.
     */
    this.endStream = function(index) {

        // Do not send requests if not connected
        if (!isConnected())
            return;

        // Explicitly close stream by sending "end" instruction
        tunnel.sendMessage("end", index);

        // Free associated index and stream if they exist
        if (output_streams[index]) {
            stream_indices.free(index);
            delete output_streams[index];
        }

    };

    /**
     * Fired whenever the state of this Guacamole.Client changes.
     * 
     * @event
     * @param {!number} state
     *     The new state of the client.
     */
    this.onstatechange = null;

    /**
     * Fired when the remote client sends a name update.
     * 
     * @event
     * @param {!string} name
     *     The new name of this client.
     */
    this.onname = null;

    /**
     * Fired when an error is reported by the remote client, and the connection
     * is being closed.
     * 
     * @event
     * @param {!Guacamole.Status} status
     *     A status object which describes the error.
     */
    this.onerror = null;
    
    /**
     * Fired when an arbitrary message is received from the tunnel that should
     * be processed by the client. By default, additional message-specific
     * events such as "onjoin" and "onleave" will fire for the received message
     * after this event has been processed. An event handler for "onmsg" need
     * not be supplied if "onjoin" and/or "onleave" will be used.
     * 
     * @event
     * @param {!number} msgcode
     *     A status code sent by the remote server that indicates the nature of
     *     the message that is being sent to the client.
     *     
     * @param {string[]} args
     *     An array of arguments to be processed with the message sent to the
     *     client.
     *
     * @return {boolean}
     *     true if message-specific events such as "onjoin" and
     *     "onleave" should be fired for this message, false otherwise. If
     *     no value is returned, message-specific events will be allowed to
     *     fire.
     */
    this.onmsg = null;

    /**
     * Fired when a user joins a shared connection.
     *
     * @event
     * @param {!string} userID
     *     A unique value representing this specific user's connection to the
     *     shared connection. This value is generated by the server and is
     *     guaranteed to be unique relative to other users of the connection.
     *
     * @param {!string} name
     *     A human-readable name representing the user that joined, such as
     *     their username. This value is provided by the web application during
     *     the connection handshake and is not necessarily unique relative to
     *     other users of the connection.
     */
    this.onjoin = null;

    /**
     * Fired when a user leaves a shared connection.
     *
     * @event
     * @param {!string} userID
     *     A unique value representing this specific user's connection to the
     *     shared connection. This value is generated by the server and is
     *     guaranteed to be unique relative to other users of the connection.
     *
     * @param {!string} name
     *     A human-readable name representing the user that left, such as their
     *     username. This value is provided by the web application during the
     *     connection handshake and is not necessarily unique relative to other
     *     users of the connection.
     */
    this.onleave = null;

    /**
     * Fired when a audio stream is created. The stream provided to this event
     * handler will contain its own event handlers for received data.
     *
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive audio data from the server.
     *
     * @param {!string} mimetype
     *     The mimetype of the audio data which will be received.
     *
     * @return {Guacamole.AudioPlayer}
     *     An object which implements the Guacamole.AudioPlayer interface and
     *     has been initialized to play the data in the provided stream, or null
     *     if the built-in audio players of the Guacamole client should be
     *     used.
     */
    this.onaudio = null;

    /**
     * Fired when a video stream is created. The stream provided to this event
     * handler will contain its own event handlers for received data.
     *
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive video data from the server.
     *
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The destination layer on which the received video data should be
     *     played. It is the responsibility of the Guacamole.VideoPlayer
     *     implementation to play the received data within this layer.
     *
     * @param {!string} mimetype
     *     The mimetype of the video data which will be received.
     *
     * @return {Guacamole.VideoPlayer}
     *     An object which implements the Guacamole.VideoPlayer interface and
     *     has been initialized to play the data in the provided stream, or null
     *     if the built-in video players of the Guacamole client should be
     *     used.
     */
    this.onvideo = null;

    /**
     * Fired when the remote client is explicitly declaring the level of
     * multi-touch support provided by a particular display layer.
     *
     * @event
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The layer whose multi-touch support level is being declared.
     *
     * @param {!number} touches
     *     The maximum number of simultaneous touches supported by the given
     *     layer, where 0 indicates that touch events are not supported at all.
     */
    this.onmultitouch = null;

    /**
     * Fired when the current value of a connection parameter is being exposed
     * by the server.
     *
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive connection parameter data from the
     *     server.
     *
     * @param {!string} mimetype
     *     The mimetype of the data which will be received.
     *
     * @param {!string} name
     *     The name of the connection parameter whose value is being exposed.
     */
    this.onargv = null;

    /**
     * Fired when the clipboard of the remote client is changing.
     * 
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive clipboard data from the server.
     *
     * @param {!string} mimetype
     *     The mimetype of the data which will be received.
     */
    this.onclipboard = null;

    /**
     * Fired when a file stream is created. The stream provided to this event
     * handler will contain its own event handlers for received data.
     * 
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive data from the server.
     *
     * @param {!string} mimetype
     *     The mimetype of the file received.
     *
     * @param {!string} filename
     *     The name of the file received.
     */
    this.onfile = null;

    /**
     * Fired when a filesystem object is created. The object provided to this
     * event handler will contain its own event handlers and functions for
     * requesting and handling data.
     *
     * @event
     * @param {!Guacamole.Object} object
     *     The created filesystem object.
     *
     * @param {!string} name
     *     The name of the filesystem.
     */
    this.onfilesystem = null;

    /**
     * Fired when a pipe stream is created. The stream provided to this event
     * handler will contain its own event handlers for received data;
     * 
     * @event
     * @param {!Guacamole.InputStream} stream
     *     The stream that will receive data from the server.
     *
     * @param {!string} mimetype
     *     The mimetype of the data which will be received.
     *
     * @param {!string} name
     *     The name of the pipe.
     */
    this.onpipe = null;
    
    /**
     * Fired when a "required" instruction is received. A required instruction
     * indicates that additional parameters are required for the connection to
     * continue, such as user credentials.
     * 
     * @event
     * @param {!string[]} parameters
     *      The names of the connection parameters that are required to be
     *      provided for the connection to continue.
     */
    this.onrequired = null;

    /**
     * Fired whenever a sync instruction is received from the server, indicating
     * that the server is finished processing any input from the client and
     * has sent any results.
     * 
     * @event
     * @param {!number} timestamp
     *     The timestamp associated with the sync instruction.
     *
     * @param {!number} frames
     *     The number of frames that were considered or combined to produce the
     *     frame associated with this sync instruction, or zero if this value
     *     is not known or the remote desktop server provides no concept of
     *     frames.
     */
    this.onsync = null;

    /**
     * Returns the layer with the given index, creating it if necessary.
     * Positive indices refer to visible layers, an index of zero refers to
     * the default layer, and negative indices refer to buffers.
     *
     * @private
     * @param {!number} index
     *     The index of the layer to retrieve.
     *
     * @return {!(Guacamole.Display.VisibleLayer|Guacamole.Layer)}
     *     The layer having the given index.
     */
    var getLayer = function getLayer(index) {

        // Get layer, create if necessary
        var layer = layers[index];
        if (!layer) {

            // Create layer based on index
            if (index === 0)
                layer = display.getDefaultLayer();
            else if (index > 0)
                layer = display.createLayer();
            else
                layer = display.createBuffer();
                
            // Add new layer
            layers[index] = layer;

        }

        return layer;

    };

    /**
     * Returns the index passed to getLayer() when the given layer was created.
     * Positive indices refer to visible layers, an index of zero refers to the
     * default layer, and negative indices refer to buffers.
     *
     * @param {!(Guacamole.Display.VisibleLayer|Guacamole.Layer)} layer
     *     The layer whose index should be determined.
     *
     * @returns {number}
     *     The index of the given layer, or null if no such layer is associated
     *     with this client.
     */
    var getLayerIndex = function getLayerIndex(layer) {

        // Avoid searching if there clearly is no such layer
        if (!layer)
            return null;

        // Search through each layer, returning the index of the given layer
        // once found
        for (var key in layers) {
            if (layer === layers[key])
                return parseInt(key);
        }

        // Otherwise, no such index
        return null;

    };

    function getParser(index) {

        var parser = parsers[index];

        // If parser not yet created, create it, and tie to the
        // oninstruction handler of the tunnel.
        if (parser == null) {
            parser = parsers[index] = new Guacamole.Parser();
            parser.oninstruction = tunnel.oninstruction;
        }

        return parser;

    }

    /**
     * Handlers for all defined layer properties.
     *
     * @private
     * @type {!Object.<string, function>}
     */
    var layerPropertyHandlers = {

        "miter-limit": function(layer, value) {
            display.setMiterLimit(layer, parseFloat(value));
        },

        "multi-touch" : function layerSupportsMultiTouch(layer, value) {

            // Process "multi-touch" property only for true visible layers (not off-screen buffers)
            if (guac_client.onmultitouch && layer instanceof Guacamole.Display.VisibleLayer)
                guac_client.onmultitouch(layer, parseInt(value));

        }

    };
    
    /**
     * Handlers for all instruction opcodes receivable by a Guacamole protocol
     * client.
     *
     * @private
     * @type {!Object.<string, function>}
     */
    var instructionHandlers = {

        "ack": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var reason = parameters[1];
            var code = parseInt(parameters[2]);

            // Get stream
            var stream = output_streams[stream_index];
            if (stream) {

                // Signal ack if handler defined
                if (stream.onack)
                    stream.onack(new Guacamole.Status(code, reason));

                // If code is an error, invalidate stream if not already
                // invalidated by onack handler
                if (code >= 0x0100 && output_streams[stream_index] === stream) {
                    stream_indices.free(stream_index);
                    delete output_streams[stream_index];
                }

            }

        },

        "arc": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var x = parseInt(parameters[1]);
            var y = parseInt(parameters[2]);
            var radius = parseInt(parameters[3]);
            var startAngle = parseFloat(parameters[4]);
            var endAngle = parseFloat(parameters[5]);
            var negative = parseInt(parameters[6]);

            display.arc(layer, x, y, radius, startAngle, endAngle, negative != 0);

        },

        "argv": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var mimetype = parameters[1];
            var name = parameters[2];

            // Create stream
            if (guac_client.onargv) {
                var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
                guac_client.onargv(stream, mimetype, name);
            }

            // Otherwise, unsupported
            else
                guac_client.sendAck(stream_index, "Receiving argument values unsupported", 0x0100);

        },

        "audio": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var mimetype = parameters[1];

            // Create stream 
            var stream = streams[stream_index] =
                    new Guacamole.InputStream(guac_client, stream_index);

            // Get player instance via callback
            var audioPlayer = null;
            if (guac_client.onaudio)
                audioPlayer = guac_client.onaudio(stream, mimetype);

            // If unsuccessful, try to use a default implementation
            if (!audioPlayer)
                audioPlayer = Guacamole.AudioPlayer.getInstance(stream, mimetype);

            // If we have successfully retrieved an audio player, send success response
            if (audioPlayer) {
                audioPlayers[stream_index] = audioPlayer;
                guac_client.sendAck(stream_index, "OK", 0x0000);
            }

            // Otherwise, mimetype must be unsupported
            else
                guac_client.sendAck(stream_index, "BAD TYPE", 0x030F);

        },

        "blob": function(parameters) {

            // Get stream 
            var stream_index = parseInt(parameters[0]);
            var data = parameters[1];
            var stream = streams[stream_index];

            // Write data
            if (stream && stream.onblob)
                stream.onblob(data);

        },

        "body" : function handleBody(parameters) {

            // Get object
            var objectIndex = parseInt(parameters[0]);
            var object = objects[objectIndex];

            var streamIndex = parseInt(parameters[1]);
            var mimetype = parameters[2];
            var name = parameters[3];

            // Create stream if handler defined
            if (object && object.onbody) {
                var stream = streams[streamIndex] = new Guacamole.InputStream(guac_client, streamIndex);
                object.onbody(stream, mimetype, name);
            }

            // Otherwise, unsupported
            else
                guac_client.sendAck(streamIndex, "Receipt of body unsupported", 0x0100);

        },

        "cfill": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var r = parseInt(parameters[2]);
            var g = parseInt(parameters[3]);
            var b = parseInt(parameters[4]);
            var a = parseInt(parameters[5]);

            display.setChannelMask(layer, channelMask);
            display.fillColor(layer, r, g, b, a);

        },

        "clip": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.clip(layer);

        },

        "clipboard": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var mimetype = parameters[1];

            // Create stream 
            if (guac_client.onclipboard) {
                var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
                guac_client.onclipboard(stream, mimetype);
            }

            // Otherwise, unsupported
            else
                guac_client.sendAck(stream_index, "Clipboard unsupported", 0x0100);

        },

        "close": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.close(layer);

        },

        "copy": function(parameters) {

            var srcL = getLayer(parseInt(parameters[0]));
            var srcX = parseInt(parameters[1]);
            var srcY = parseInt(parameters[2]);
            var srcWidth = parseInt(parameters[3]);
            var srcHeight = parseInt(parameters[4]);
            var channelMask = parseInt(parameters[5]);
            var dstL = getLayer(parseInt(parameters[6]));
            var dstX = parseInt(parameters[7]);
            var dstY = parseInt(parameters[8]);

            display.setChannelMask(dstL, channelMask);
            display.copy(srcL, srcX, srcY, srcWidth, srcHeight, 
                         dstL, dstX, dstY);

        },

        "cstroke": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var cap = lineCap[parseInt(parameters[2])];
            var join = lineJoin[parseInt(parameters[3])];
            var thickness = parseInt(parameters[4]);
            var r = parseInt(parameters[5]);
            var g = parseInt(parameters[6]);
            var b = parseInt(parameters[7]);
            var a = parseInt(parameters[8]);

            display.setChannelMask(layer, channelMask);
            display.strokeColor(layer, cap, join, thickness, r, g, b, a);

        },

        "cursor": function(parameters) {

            var cursorHotspotX = parseInt(parameters[0]);
            var cursorHotspotY = parseInt(parameters[1]);
            var srcL = getLayer(parseInt(parameters[2]));
            var srcX = parseInt(parameters[3]);
            var srcY = parseInt(parameters[4]);
            var srcWidth = parseInt(parameters[5]);
            var srcHeight = parseInt(parameters[6]);

            display.setCursor(cursorHotspotX, cursorHotspotY,
                              srcL, srcX, srcY, srcWidth, srcHeight);

        },

        "curve": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var cp1x = parseInt(parameters[1]);
            var cp1y = parseInt(parameters[2]);
            var cp2x = parseInt(parameters[3]);
            var cp2y = parseInt(parameters[4]);
            var x = parseInt(parameters[5]);
            var y = parseInt(parameters[6]);

            display.curveTo(layer, cp1x, cp1y, cp2x, cp2y, x, y);

        },

        "disconnect" : function handleDisconnect(parameters) {

            // Explicitly tear down connection
            guac_client.disconnect();

        },

        "dispose": function(parameters) {
            
            var layer_index = parseInt(parameters[0]);

            // If visible layer, remove from parent
            if (layer_index > 0) {

                // Remove from parent
                var layer = getLayer(layer_index);
                display.dispose(layer);

                // Delete reference
                delete layers[layer_index];

            }

            // If buffer, just delete reference
            else if (layer_index < 0)
                delete layers[layer_index];

            // Attempting to dispose the root layer currently has no effect.

        },

        "distort": function(parameters) {

            var layer_index = parseInt(parameters[0]);
            var a = parseFloat(parameters[1]);
            var b = parseFloat(parameters[2]);
            var c = parseFloat(parameters[3]);
            var d = parseFloat(parameters[4]);
            var e = parseFloat(parameters[5]);
            var f = parseFloat(parameters[6]);

            // Only valid for visible layers (not buffers)
            if (layer_index >= 0) {
                var layer = getLayer(layer_index);
                display.distort(layer, a, b, c, d, e, f);
            }

        },
 
        "error": function(parameters) {

            var reason = parameters[0];
            var code = parseInt(parameters[1]);

            // Call handler if defined
            if (guac_client.onerror)
                guac_client.onerror(new Guacamole.Status(code, reason));

            guac_client.disconnect();

        },

        "end": function(parameters) {

            var stream_index = parseInt(parameters[0]);

            // Get stream
            var stream = streams[stream_index];
            if (stream) {

                // Signal end of stream if handler defined
                if (stream.onend)
                    stream.onend();

                // Invalidate stream
                delete streams[stream_index];

            }

        },

        "file": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var mimetype = parameters[1];
            var filename = parameters[2];

            // Create stream 
            if (guac_client.onfile) {
                var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
                guac_client.onfile(stream, mimetype, filename);
            }

            // Otherwise, unsupported
            else
                guac_client.sendAck(stream_index, "File transfer unsupported", 0x0100);

        },

        "filesystem" : function handleFilesystem(parameters) {

            var objectIndex = parseInt(parameters[0]);
            var name = parameters[1];

            // Create object, if supported
            if (guac_client.onfilesystem) {
                var object = objects[objectIndex] = new Guacamole.Object(guac_client, objectIndex);
                guac_client.onfilesystem(object, name);
            }

            // If unsupported, simply ignore the availability of the filesystem

        },

        "identity": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.setTransform(layer, 1, 0, 0, 1, 0, 0);

        },

        "img": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var channelMask = parseInt(parameters[1]);
            var layer = getLayer(parseInt(parameters[2]));
            var mimetype = parameters[3];
            var x = parseInt(parameters[4]);
            var y = parseInt(parameters[5]);

            // Create stream
            var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);

            // Draw received contents once decoded
            display.setChannelMask(layer, channelMask);
            display.drawStream(layer, x, y, stream, mimetype);

        },

        "jpeg": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var x = parseInt(parameters[2]);
            var y = parseInt(parameters[3]);
            var data = parameters[4];

            display.setChannelMask(layer, channelMask);
            display.draw(layer, x, y, "data:image/jpeg;base64," + data);

        },

        "lfill": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var srcLayer = getLayer(parseInt(parameters[2]));

            display.setChannelMask(layer, channelMask);
            display.fillLayer(layer, srcLayer);

        },

        "line": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var x = parseInt(parameters[1]);
            var y = parseInt(parameters[2]);

            display.lineTo(layer, x, y);

        },

        "lstroke": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var srcLayer = getLayer(parseInt(parameters[2]));

            display.setChannelMask(layer, channelMask);
            display.strokeLayer(layer, srcLayer);

        },

        "mouse" : function handleMouse(parameters) {

            var x = parseInt(parameters[0]);
            var y = parseInt(parameters[1]);

            // Display and move software cursor to received coordinates
            display.showCursor(true);
            display.moveCursor(x, y);

        },

        "move": function(parameters) {
            
            var layer_index = parseInt(parameters[0]);
            var parent_index = parseInt(parameters[1]);
            var x = parseInt(parameters[2]);
            var y = parseInt(parameters[3]);
            var z = parseInt(parameters[4]);

            // Only valid for non-default layers
            if (layer_index > 0 && parent_index >= 0) {
                var layer = getLayer(layer_index);
                var parent = getLayer(parent_index);
                display.move(layer, parent, x, y, z);
            }

        },
        
        "msg" : function(parameters) {

            var userID;
            var username;

            // Fire general message handling event first
            var allowDefault = true;
            var msgid = parseInt(parameters[0]);
            if (guac_client.onmsg) {
                allowDefault = guac_client.onmsg(msgid, parameters.slice(1));
                if (allowDefault === undefined)
                    allowDefault = true;
            }

            // Fire message-specific convenience events if not prevented by the
            // "onmsg" handler
            if (allowDefault) {
                switch (msgid) {

                    case Guacamole.Client.Message.USER_JOINED:
                        userID = parameters[1];
                        username = parameters[2];
                        if (guac_client.onjoin)
                            guac_client.onjoin(userID, username);
                        break;

                    case Guacamole.Client.Message.USER_LEFT:
                        userID = parameters[1];
                        username = parameters[2];
                        if (guac_client.onleave)
                            guac_client.onleave(userID, username);
                        break;

                }
            }
            
        },

        "name": function(parameters) {
            if (guac_client.onname) guac_client.onname(parameters[0]);
        },

        "nest": function(parameters) {
            var parser = getParser(parseInt(parameters[0]));
            parser.receive(parameters[1]);
        },

        "pipe": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var mimetype = parameters[1];
            var name = parameters[2];

            // Create stream 
            if (guac_client.onpipe) {
                var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
                guac_client.onpipe(stream, mimetype, name);
            }

            // Otherwise, unsupported
            else
                guac_client.sendAck(stream_index, "Named pipes unsupported", 0x0100);

        },

        "png": function(parameters) {

            var channelMask = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var x = parseInt(parameters[2]);
            var y = parseInt(parameters[3]);
            var data = parameters[4];

            display.setChannelMask(layer, channelMask);
            display.draw(layer, x, y, "data:image/png;base64," + data);

        },

        "pop": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.pop(layer);

        },

        "push": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.push(layer);

        },
 
        "rect": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var x = parseInt(parameters[1]);
            var y = parseInt(parameters[2]);
            var w = parseInt(parameters[3]);
            var h = parseInt(parameters[4]);

            display.rect(layer, x, y, w, h);

        },
                
        "required": function required(parameters) {
            if (guac_client.onrequired) guac_client.onrequired(parameters);
        },
        
        "reset": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));

            display.reset(layer);

        },
        
        "set": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var name = parameters[1];
            var value = parameters[2];

            // Call property handler if defined
            var handler = layerPropertyHandlers[name];
            if (handler)
                handler(layer, value);

        },

        "shade": function(parameters) {
            
            var layer_index = parseInt(parameters[0]);
            var a = parseInt(parameters[1]);

            // Only valid for visible layers (not buffers)
            if (layer_index >= 0) {
                var layer = getLayer(layer_index);
                display.shade(layer, a);
            }

        },

        "size": function(parameters) {

            var layer_index = parseInt(parameters[0]);
            var layer = getLayer(layer_index);
            var width = parseInt(parameters[1]);
            var height = parseInt(parameters[2]);

            display.resize(layer, width, height);

        },
        
        "start": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var x = parseInt(parameters[1]);
            var y = parseInt(parameters[2]);

            display.moveTo(layer, x, y);

        },

        "sync": function(parameters) {

            var timestamp = parseInt(parameters[0]);
            var frames = parameters[1] ? parseInt(parameters[1]) : 0;

            // Flush display, send sync when done
            display.flush(function displaySyncComplete() {

                // Synchronize all audio players
                for (var index in audioPlayers) {
                    var audioPlayer = audioPlayers[index];
                    if (audioPlayer)
                        audioPlayer.sync();
                }

                // Send sync response to server
                if (timestamp !== currentTimestamp) {
                    tunnel.sendMessage("sync", timestamp);
                    currentTimestamp = timestamp;
                }

            }, timestamp, frames);

            // If received first update, no longer waiting.
            if (currentState === Guacamole.Client.State.WAITING)
                setState(Guacamole.Client.State.CONNECTED);

            // Call sync handler if defined
            if (guac_client.onsync)
                guac_client.onsync(timestamp, frames);

        },

        "transfer": function(parameters) {

            var srcL = getLayer(parseInt(parameters[0]));
            var srcX = parseInt(parameters[1]);
            var srcY = parseInt(parameters[2]);
            var srcWidth = parseInt(parameters[3]);
            var srcHeight = parseInt(parameters[4]);
            var function_index = parseInt(parameters[5]);
            var dstL = getLayer(parseInt(parameters[6]));
            var dstX = parseInt(parameters[7]);
            var dstY = parseInt(parameters[8]);

            /* SRC */
            if (function_index === 0x3)
                display.put(srcL, srcX, srcY, srcWidth, srcHeight, 
                    dstL, dstX, dstY);

            /* Anything else that isn't a NO-OP */
            else if (function_index !== 0x5)
                display.transfer(srcL, srcX, srcY, srcWidth, srcHeight, 
                    dstL, dstX, dstY, Guacamole.Client.DefaultTransferFunction[function_index]);

        },

        "transform": function(parameters) {

            var layer = getLayer(parseInt(parameters[0]));
            var a = parseFloat(parameters[1]);
            var b = parseFloat(parameters[2]);
            var c = parseFloat(parameters[3]);
            var d = parseFloat(parameters[4]);
            var e = parseFloat(parameters[5]);
            var f = parseFloat(parameters[6]);

            display.transform(layer, a, b, c, d, e, f);

        },

        "undefine" : function handleUndefine(parameters) {

            // Get object
            var objectIndex = parseInt(parameters[0]);
            var object = objects[objectIndex];

            // Signal end of object definition
            if (object && object.onundefine)
                object.onundefine();

        },

        "video": function(parameters) {

            var stream_index = parseInt(parameters[0]);
            var layer = getLayer(parseInt(parameters[1]));
            var mimetype = parameters[2];

            // Create stream
            var stream = streams[stream_index] =
                    new Guacamole.InputStream(guac_client, stream_index);

            // Get player instance via callback
            var videoPlayer = null;
            if (guac_client.onvideo)
                videoPlayer = guac_client.onvideo(stream, layer, mimetype);

            // If unsuccessful, try to use a default implementation
            if (!videoPlayer)
                videoPlayer = Guacamole.VideoPlayer.getInstance(stream, layer, mimetype);

            // If we have successfully retrieved an video player, send success response
            if (videoPlayer) {
                videoPlayers[stream_index] = videoPlayer;
                guac_client.sendAck(stream_index, "OK", 0x0000);
            }

            // Otherwise, mimetype must be unsupported
            else
                guac_client.sendAck(stream_index, "BAD TYPE", 0x030F);

        }

    };

    /**
     * Sends a keep-alive ping to the Guacamole server, advising the server
     * that the client is still connected and responding. The lastSentKeepAlive
     * timestamp is automatically updated as a result of calling this function.
     *
     * @private
     */
    var sendKeepAlive = function sendKeepAlive() {
        tunnel.sendMessage('nop');
        lastSentKeepAlive = new Date().getTime();
    };

    /**
     * Schedules the next keep-alive ping based on the KEEP_ALIVE_FREQUENCY and
     * the time that the last ping was sent, if ever. If enough time has
     * elapsed that a ping should have already been sent, calling this function
     * will send that ping immediately.
     *
     * @private
     */
    var scheduleKeepAlive = function scheduleKeepAlive() {

        window.clearTimeout(keepAliveTimeout);

        var currentTime = new Date().getTime();
        var keepAliveDelay = Math.max(lastSentKeepAlive + KEEP_ALIVE_FREQUENCY - currentTime, 0);

        // Ping server regularly to keep connection alive, but send the ping
        // immediately if enough time has elapsed that it should have already
        // been sent
        if (keepAliveDelay > 0)
            keepAliveTimeout = window.setTimeout(sendKeepAlive, keepAliveDelay);
        else
            sendKeepAlive();

    };

    /**
     * Stops sending any further keep-alive pings. If a keep-alive ping was
     * scheduled to be sent, that ping is cancelled.
     *
     * @private
     */
    var stopKeepAlive = function stopKeepAlive() {
        window.clearTimeout(keepAliveTimeout);
    };

    tunnel.oninstruction = function(opcode, parameters) {

        var handler = instructionHandlers[opcode];
        if (handler)
            handler(parameters);

        // Leverage network activity to ensure the next keep-alive ping is
        // sent, even if the browser is currently throttling timers
        scheduleKeepAlive();

    };

    /**
     * Sends a disconnect instruction to the server and closes the tunnel.
     */
    this.disconnect = function() {

        // Only attempt disconnection not disconnected.
        if (currentState != Guacamole.Client.State.DISCONNECTED
                && currentState != Guacamole.Client.State.DISCONNECTING) {

            setState(Guacamole.Client.State.DISCONNECTING);

            // Stop sending keep-alive messages
            stopKeepAlive();

            // Send disconnect message and disconnect
            tunnel.sendMessage("disconnect");
            tunnel.disconnect();
            setState(Guacamole.Client.State.DISCONNECTED);

        }

    };
    
    /**
     * Connects the underlying tunnel of this Guacamole.Client, passing the
     * given arbitrary data to the tunnel during the connection process.
     *
     * @param {string} data
     *     Arbitrary connection data to be sent to the underlying tunnel during
     *     the connection process.
     *
     * @throws {!Guacamole.Status}
     *     If an error occurs during connection.
     */
    this.connect = function(data) {

        setState(Guacamole.Client.State.CONNECTING);

        try {
            tunnel.connect(data);
        }
        catch (status) {
            setState(Guacamole.Client.State.IDLE);
            throw status;
        }

        // Regularly send keep-alive ping to ensure the server knows we're
        // still here, even if not active
        scheduleKeepAlive();

        setState(Guacamole.Client.State.WAITING);
    };

};

/**
 * All possible Guacamole Client states.
 * 
 * @type {!Object.<string, number>}
 */
Guacamole.Client.State = {
    
    /**
     * The client is idle, with no active connection.
     * 
     * @type number
     */
    "IDLE" : 0,
    
    /**
     * The client is in the process of establishing a connection.
     * 
     * @type {!number}
     */
    "CONNECTING" : 1,
    
    /**
     * The client is waiting on further information or a remote server to
     * establish the connection.
     * 
     * @type {!number}
     */
    "WAITING" : 2,
    
    /**
     * The client is actively connected to a remote server.
     * 
     * @type {!number}
     */
    "CONNECTED" : 3,
    
    /**
     * The client is in the process of disconnecting from the remote server.
     * 
     * @type {!number}
     */
    "DISCONNECTING" : 4,
    
    /**
     * The client has completed the connection and is no longer connected.
     * 
     * @type {!number}
     */
    "DISCONNECTED" : 5
    
};

/**
 * Map of all Guacamole binary raster operations to transfer functions.
 *
 * @private
 * @type {!Object.<number, function>}
 */
Guacamole.Client.DefaultTransferFunction = {

    /* BLACK */
    0x0: function (src, dst) {
        dst.red = dst.green = dst.blue = 0x00;
    },

    /* WHITE */
    0xF: function (src, dst) {
        dst.red = dst.green = dst.blue = 0xFF;
    },

    /* SRC */
    0x3: function (src, dst) {
        dst.red   = src.red;
        dst.green = src.green;
        dst.blue  = src.blue;
        dst.alpha = src.alpha;
    },

    /* DEST (no-op) */
    0x5: function (src, dst) {
        // Do nothing
    },

    /* Invert SRC */
    0xC: function (src, dst) {
        dst.red   = 0xFF & ~src.red;
        dst.green = 0xFF & ~src.green;
        dst.blue  = 0xFF & ~src.blue;
        dst.alpha =  src.alpha;
    },
    
    /* Invert DEST */
    0xA: function (src, dst) {
        dst.red   = 0xFF & ~dst.red;
        dst.green = 0xFF & ~dst.green;
        dst.blue  = 0xFF & ~dst.blue;
    },

    /* AND */
    0x1: function (src, dst) {
        dst.red   =  ( src.red   &  dst.red);
        dst.green =  ( src.green &  dst.green);
        dst.blue  =  ( src.blue  &  dst.blue);
    },

    /* NAND */
    0xE: function (src, dst) {
        dst.red   = 0xFF & ~( src.red   &  dst.red);
        dst.green = 0xFF & ~( src.green &  dst.green);
        dst.blue  = 0xFF & ~( src.blue  &  dst.blue);
    },

    /* OR */
    0x7: function (src, dst) {
        dst.red   =  ( src.red   |  dst.red);
        dst.green =  ( src.green |  dst.green);
        dst.blue  =  ( src.blue  |  dst.blue);
    },

    /* NOR */
    0x8: function (src, dst) {
        dst.red   = 0xFF & ~( src.red   |  dst.red);
        dst.green = 0xFF & ~( src.green |  dst.green);
        dst.blue  = 0xFF & ~( src.blue  |  dst.blue);
    },

    /* XOR */
    0x6: function (src, dst) {
        dst.red   =  ( src.red   ^  dst.red);
        dst.green =  ( src.green ^  dst.green);
        dst.blue  =  ( src.blue  ^  dst.blue);
    },

    /* XNOR */
    0x9: function (src, dst) {
        dst.red   = 0xFF & ~( src.red   ^  dst.red);
        dst.green = 0xFF & ~( src.green ^  dst.green);
        dst.blue  = 0xFF & ~( src.blue  ^  dst.blue);
    },

    /* AND inverted source */
    0x4: function (src, dst) {
        dst.red   =  0xFF & (~src.red   &  dst.red);
        dst.green =  0xFF & (~src.green &  dst.green);
        dst.blue  =  0xFF & (~src.blue  &  dst.blue);
    },

    /* OR inverted source */
    0xD: function (src, dst) {
        dst.red   =  0xFF & (~src.red   |  dst.red);
        dst.green =  0xFF & (~src.green |  dst.green);
        dst.blue  =  0xFF & (~src.blue  |  dst.blue);
    },

    /* AND inverted destination */
    0x2: function (src, dst) {
        dst.red   =  0xFF & ( src.red   & ~dst.red);
        dst.green =  0xFF & ( src.green & ~dst.green);
        dst.blue  =  0xFF & ( src.blue  & ~dst.blue);
    },

    /* OR inverted destination */
    0xB: function (src, dst) {
        dst.red   =  0xFF & ( src.red   | ~dst.red);
        dst.green =  0xFF & ( src.green | ~dst.green);
        dst.blue  =  0xFF & ( src.blue  | ~dst.blue);
    }

};

/**
 * A list of possible messages that can be sent by the server for processing
 * by the client.
 * 
 * @type {!Object.<string, number>}
 */
Guacamole.Client.Message = {
    
    /**
     * A client message that indicates that a user has joined an existing
     * connection. This message expects a single additional argument - the
     * name of the user who has joined the connection.
     * 
     * @type {!number}
     */
    "USER_JOINED": 0x0001,
    
    /**
     * A client message that indicates that a user has left an existing
     * connection. This message expects a single additional argument - the
     * name of the user who has left the connection.
     * 
     * @type {!number}
     */
    "USER_LEFT": 0x0002
    
};
