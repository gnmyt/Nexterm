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
 * The Guacamole display. The display does not deal with the Guacamole
 * protocol, and instead implements a set of graphical operations which
 * embody the set of operations present in the protocol. The order operations
 * are executed is guaranteed to be in the same order as their corresponding
 * functions are called.
 * 
 * @constructor
 */
Guacamole.Display = function() {

    /**
     * Reference to this Guacamole.Display.
     * @private
     */
    var guac_display = this;

    var displayWidth = 0;
    var displayHeight = 0;
    var displayScale = 1;

    // Create display
    var display = document.createElement("div");
    display.style.position = "relative";
    display.style.width = displayWidth + "px";
    display.style.height = displayHeight + "px";

    // Ensure transformations on display originate at 0,0
    display.style.transformOrigin =
    display.style.webkitTransformOrigin =
    display.style.MozTransformOrigin =
    display.style.OTransformOrigin =
    display.style.msTransformOrigin =
        "0 0";

    // Create default layer
    var default_layer = new Guacamole.Display.VisibleLayer(displayWidth, displayHeight);

    // Create cursor layer
    var cursor = new Guacamole.Display.VisibleLayer(0, 0);
    cursor.setChannelMask(Guacamole.Layer.SRC);

    // Add default layer and cursor to display
    display.appendChild(default_layer.getElement());
    display.appendChild(cursor.getElement());

    // Create bounding div 
    var bounds = document.createElement("div");
    bounds.style.position = "relative";
    bounds.style.width = (displayWidth*displayScale) + "px";
    bounds.style.height = (displayHeight*displayScale) + "px";

    // Add display to bounds
    bounds.appendChild(display);

    /**
     * The X coordinate of the hotspot of the mouse cursor. The hotspot is
     * the relative location within the image of the mouse cursor at which
     * each click occurs.
     * 
     * @type {!number}
     */
    this.cursorHotspotX = 0;

    /**
     * The Y coordinate of the hotspot of the mouse cursor. The hotspot is
     * the relative location within the image of the mouse cursor at which
     * each click occurs.
     * 
     * @type {!number}
     */
    this.cursorHotspotY = 0;

    /**
     * The current X coordinate of the local mouse cursor. This is not
     * necessarily the location of the actual mouse - it refers only to
     * the location of the cursor image within the Guacamole display, as
     * last set by moveCursor().
     * 
     * @type {!number}
     */
    this.cursorX = 0;

    /**
     * The current X coordinate of the local mouse cursor. This is not
     * necessarily the location of the actual mouse - it refers only to
     * the location of the cursor image within the Guacamole display, as
     * last set by moveCursor().
     * 
     * @type {!number}
     */
    this.cursorY = 0;

    /**
     * The number of milliseconds over which display rendering statistics
     * should be gathered, dispatching {@link #onstatistics} events as those
     * statistics are available. If set to zero, no statistics will be
     * gathered.
     *
     * @default 0
     * @type {!number}
     */
    this.statisticWindow = 0;

    /**
     * Fired when the default layer (and thus the entire Guacamole display)
     * is resized.
     * 
     * @event
     * @param {!number} width
     *     The new width of the Guacamole display.
     *
     * @param {!number} height
     *     The new height of the Guacamole display.
     */
    this.onresize = null;

    /**
     * Fired whenever the local cursor image is changed. This can be used to
     * implement special handling of the client-side cursor, or to override
     * the default use of a software cursor layer.
     * 
     * @event
     * @param {!HTMLCanvasElement} canvas
     *     The cursor image.
     *
     * @param {!number} x
     *     The X-coordinate of the cursor hotspot.
     *
     * @param {!number} y
     *     The Y-coordinate of the cursor hotspot.
     */
    this.oncursor = null;

    /**
     * Fired whenever performance statistics are available for recently-
     * rendered frames. This event will fire only if {@link #statisticWindow}
     * is non-zero.
     *
     * @event
     * @param {!Guacamole.Display.Statistics} stats
     *     An object containing general rendering performance statistics for
     *     the remote desktop, Guacamole server, and Guacamole client.
     */
    this.onstatistics = null;

    /**
     * The queue of all pending Tasks. Tasks will be run in order, with new
     * tasks added at the end of the queue and old tasks removed from the
     * front of the queue (FIFO). These tasks will eventually be grouped
     * into a Frame.
     *
     * @private
     * @type {!Task[]}
     */
    var tasks = [];

    /**
     * The queue of all frames. Each frame is a pairing of an array of tasks
     * and a callback which must be called when the frame is rendered.
     *
     * @private
     * @type {!Frame[]}
     */
    var frames = [];

    /**
     * Flushes all pending frames synchronously. This function will block until
     * all pending frames have rendered. If a frame is currently blocked by an
     * asynchronous operation like an image load, this function will return
     * after reaching that operation and the flush operation will
     * automamtically resume after that operation completes.
     *
     * @private
     */
    var syncFlush = function syncFlush() {

        var localTimestamp = 0;
        var remoteTimestamp = 0;

        var renderedLogicalFrames = 0;
        var rendered_frames = 0;

        // Draw all pending frames, if ready
        while (rendered_frames < frames.length) {

            var frame = frames[rendered_frames];
            if (!frame.isReady())
                break;

            frame.flush();

            localTimestamp = frame.localTimestamp;
            remoteTimestamp = frame.remoteTimestamp;
            renderedLogicalFrames += frame.logicalFrames;
            rendered_frames++;

        } 

        // Remove rendered frames from array
        frames.splice(0, rendered_frames);

        if (rendered_frames)
            notifyFlushed(localTimestamp, remoteTimestamp, renderedLogicalFrames);

    };

    /**
     * Recently-gathered display render statistics, as made available by calls
     * to notifyFlushed(). The contents of this array will be trimmed to
     * contain only up to {@link #statisticWindow} milliseconds of statistics.
     *
     * @private
     * @type {Guacamole.Display.Statistics[]}
     */
    var statistics = [];

    /**
     * Notifies that one or more frames have been successfully rendered
     * (flushed) to the display.
     *
     * @private
     * @param {!number} localTimestamp
     *     The local timestamp of the point in time at which the most recent,
     *     flushed frame was received by the display, in milliseconds since the
     *     Unix Epoch.
     *
     * @param {!number} remoteTimestamp
     *     The remote timestamp of sync instruction associated with the most
     *     recent, flushed frame received by the display. This timestamp is in
     *     milliseconds, but is arbitrary, having meaning only relative to
     *     other timestamps in the same connection.
     *
     * @param {!number} logicalFrames
     *     The number of remote desktop frames that were flushed.
     */
    var notifyFlushed = function notifyFlushed(localTimestamp, remoteTimestamp, logicalFrames) {

        // Ignore if statistics are not being gathered
        if (!guac_display.statisticWindow)
            return;

        var current = new Date().getTime();

        // Find the first statistic that is still within the configured time
        // window
        for (var first = 0; first < statistics.length; first++) {
            if (current - statistics[first].timestamp <= guac_display.statisticWindow)
                break;
        }

        // Remove all statistics except those within the time window
        statistics.splice(0, first - 1);

        // Record statistics for latest frame
        statistics.push({
            localTimestamp : localTimestamp,
            remoteTimestamp : remoteTimestamp,
            timestamp : current,
            frames : logicalFrames
        });

        // Determine the actual time interval of the available statistics (this
        // will not perfectly match the configured interval, which is an upper
        // bound)
        var statDuration = (statistics[statistics.length - 1].timestamp - statistics[0].timestamp) / 1000;

        // Determine the amount of time that elapsed remotely (within the
        // remote desktop)
        var remoteDuration = (statistics[statistics.length - 1].remoteTimestamp - statistics[0].remoteTimestamp) / 1000;

        // Calculate the number of frames that have been rendered locally
        // within the configured time interval
        var localFrames = statistics.length;

        // Calculate the number of frames actually received from the remote
        // desktop by the Guacamole server
        var remoteFrames = statistics.reduce(function sumFrames(prev, stat) {
            return prev + stat.frames;
        }, 0);

        // Calculate the number of frames that the Guacamole server had to
        // drop or combine with other frames
        var drops = statistics.reduce(function sumDrops(prev, stat) {
            return prev + Math.max(0, stat.frames - 1);
        }, 0);

        // Produce lag and FPS statistics from above raw measurements
        var stats = new Guacamole.Display.Statistics({
            processingLag : current - localTimestamp,
            desktopFps : (remoteDuration && remoteFrames) ? remoteFrames / remoteDuration : null,
            clientFps : statDuration ? localFrames / statDuration : null,
            serverFps : remoteDuration ? localFrames / remoteDuration : null,
            dropRate : remoteDuration ? drops / remoteDuration : null
        });

        // Notify of availability of new statistics
        if (guac_display.onstatistics)
            guac_display.onstatistics(stats);

    };

    /**
     * Flushes all pending frames.
     * @private
     */
    function __flush_frames() {
        syncFlush();
    }

    /**
     * An ordered list of tasks which must be executed atomically. Once
     * executed, an associated (and optional) callback will be called.
     *
     * @private
     * @constructor
     * @param {function} [callback]
     *     The function to call when this frame is rendered.
     *
     * @param {!Task[]} tasks
     *     The set of tasks which must be executed to render this frame.
     *
     * @param {number} [timestamp]
     *     The remote timestamp of sync instruction associated with this frame.
     *     This timestamp is in milliseconds, but is arbitrary, having meaning
     *     only relative to other remote timestamps in the same connection. If
     *     omitted, a compatible but local timestamp will be used instead.
     *
     * @param {number} [logicalFrames=0]
     *     The number of remote desktop frames that were combined to produce
     *     this frame, or zero if this value is unknown or inapplicable.
     */
    var Frame = function Frame(callback, tasks, timestamp, logicalFrames) {

        /**
         * The local timestamp of the point in time at which this frame was
         * received by the display, in milliseconds since the Unix Epoch.
         *
         * @type {!number}
         */
        this.localTimestamp = new Date().getTime();

        /**
         * The remote timestamp of sync instruction associated with this frame.
         * This timestamp is in milliseconds, but is arbitrary, having meaning
         * only relative to other remote timestamps in the same connection.
         *
         * @type {!number}
         */
        this.remoteTimestamp = timestamp || this.localTimestamp;

        /**
         * The number of remote desktop frames that were combined to produce
         * this frame. If unknown or not applicable, this will be zero.
         *
         * @type {!number}
         */
        this.logicalFrames = logicalFrames || 0;

        /**
         * Cancels rendering of this frame and all associated tasks. The
         * callback provided at construction time, if any, is not invoked.
         */
        this.cancel = function cancel() {

            callback = null;

            tasks.forEach(function cancelTask(task) {
                task.cancel();
            });

            tasks = [];

        };

        /**
         * Returns whether this frame is ready to be rendered. This function
         * returns true if and only if ALL underlying tasks are unblocked.
         * 
         * @returns {!boolean}
         *     true if all underlying tasks are unblocked, false otherwise.
         */
        this.isReady = function() {

            // Search for blocked tasks
            for (var i=0; i < tasks.length; i++) {
                if (tasks[i].blocked)
                    return false;
            }

            // If no blocked tasks, the frame is ready
            return true;

        };

        /**
         * Renders this frame, calling the associated callback, if any, after
         * the frame is complete. This function MUST only be called when no
         * blocked tasks exist. Calling this function with blocked tasks
         * will result in undefined behavior.
         */
        this.flush = function() {

            // Draw all pending tasks.
            for (var i=0; i < tasks.length; i++)
                tasks[i].execute();

            // Call callback
            if (callback) callback();

        };

    };

    /**
     * A container for an task handler. Each operation which must be ordered
     * is associated with a Task that goes into a task queue. Tasks in this
     * queue are executed in order once their handlers are set, while Tasks 
     * without handlers block themselves and any following Tasks from running.
     *
     * @constructor
     * @private
     * @param {function} [taskHandler]
     *     The function to call when this task runs, if any.
     *
     * @param {boolean} [blocked]
     *     Whether this task should start blocked.
     */
    function Task(taskHandler, blocked) {

        /**
         * Reference to this Task.
         *
         * @private
         * @type {!Guacamole.Display.Task}
         */
        var task = this;
       
        /**
         * Whether this Task is blocked.
         * 
         * @type {boolean}
         */
        this.blocked = blocked;

        /**
         * Cancels this task such that it will not run. The task handler
         * provided at construction time, if any, is not invoked. Calling
         * execute() after calling this function has no effect.
         */
        this.cancel = function cancel() {
            task.blocked = false;
            taskHandler = null;
        };

        /**
         * Unblocks this Task, allowing it to run.
         */
        this.unblock = function() {
            if (task.blocked) {
                task.blocked = false;

                if (frames.length)
                    __flush_frames();

            }
        };

        /**
         * Calls the handler associated with this task IMMEDIATELY. This
         * function does not track whether this task is marked as blocked.
         * Enforcing the blocked status of tasks is up to the caller.
         */
        this.execute = function() {
            if (taskHandler) taskHandler();
        };

    }

    /**
     * Schedules a task for future execution. The given handler will execute
     * immediately after all previous tasks upon frame flush, unless this
     * task is blocked. If any tasks is blocked, the entire frame will not
     * render (and no tasks within will execute) until all tasks are unblocked.
     * 
     * @private
     * @param {function} [handler]
     *     The function to call when possible, if any.
     *
     * @param {boolean} [blocked]
     *     Whether the task should start blocked.
     *
     * @returns {!Task}
     *     The Task created and added to the queue for future running.
     */
    function scheduleTask(handler, blocked) {
        var task = new Task(handler, blocked);
        tasks.push(task);
        return task;
    }

    /**
     * Returns the element which contains the Guacamole display.
     * 
     * @return {!Element}
     *     The element containing the Guacamole display.
     */
    this.getElement = function() {
        return bounds;
    };

    /**
     * Returns the width of this display.
     * 
     * @return {!number}
     *     The width of this display;
     */
    this.getWidth = function() {
        return displayWidth;
    };

    /**
     * Returns the height of this display.
     * 
     * @return {!number}
     *     The height of this display;
     */
    this.getHeight = function() {
        return displayHeight;
    };

    /**
     * Returns the default layer of this display. Each Guacamole display always
     * has at least one layer. Other layers can optionally be created within
     * this layer, but the default layer cannot be removed and is the absolute
     * ancestor of all other layers.
     * 
     * @return {!Guacamole.Display.VisibleLayer}
     *     The default layer.
     */
    this.getDefaultLayer = function() {
        return default_layer;
    };

    /**
     * Returns the cursor layer of this display. Each Guacamole display contains
     * a layer for the image of the mouse cursor. This layer is a special case
     * and exists above all other layers, similar to the hardware mouse cursor.
     * 
     * @return {!Guacamole.Display.VisibleLayer}
     *     The cursor layer.
     */
    this.getCursorLayer = function() {
        return cursor;
    };

    /**
     * Creates a new layer. The new layer will be a direct child of the default
     * layer, but can be moved to be a child of any other layer. Layers returned
     * by this function are visible.
     * 
     * @return {!Guacamole.Display.VisibleLayer}
     *     The newly-created layer.
     */
    this.createLayer = function() {
        var layer = new Guacamole.Display.VisibleLayer(displayWidth, displayHeight);
        layer.move(default_layer, 0, 0, 0);
        return layer;
    };

    /**
     * Creates a new buffer. Buffers are invisible, off-screen surfaces. They
     * are implemented in the same manner as layers, but do not provide the
     * same nesting semantics.
     * 
     * @return {!Guacamole.Layer}
     *     The newly-created buffer.
     */
    this.createBuffer = function() {
        var buffer = new Guacamole.Layer(0, 0);
        buffer.autosize = 1;
        return buffer;
    };

    /**
     * Flush all pending draw tasks, if possible, as a new frame. If the entire
     * frame is not ready, the flush will wait until all required tasks are
     * unblocked.
     * 
     * @param {function} [callback]
     *     The function to call when this frame is flushed. This may happen
     *     immediately, or later when blocked tasks become unblocked.
     *
     * @param {number} timestamp
     *     The remote timestamp of sync instruction associated with this frame.
     *     This timestamp is in milliseconds, but is arbitrary, having meaning
     *     only relative to other remote timestamps in the same connection.
     *
     * @param {number} logicalFrames
     *     The number of remote desktop frames that were combined to produce
     *     this frame.
     */
    this.flush = function(callback, timestamp, logicalFrames) {

        // Add frame, reset tasks
        frames.push(new Frame(callback, tasks, timestamp, logicalFrames));
        tasks = [];

        // Attempt flush
        __flush_frames();

    };

    /**
     * Cancels rendering of all pending frames and associated rendering
     * operations. The callbacks provided to outstanding past calls to flush(),
     * if any, are not invoked.
     */
    this.cancel = function cancel() {

        frames.forEach(function cancelFrame(frame) {
            frame.cancel();
        });

        frames = [];

        tasks.forEach(function cancelTask(task) {
            task.cancel();
        });

        tasks = [];

    };

    /**
     * Sets the hotspot and image of the mouse cursor displayed within the
     * Guacamole display.
     * 
     * @param {!number} hotspotX
     *     The X coordinate of the cursor hotspot.
     *
     * @param {!number} hotspotY
     *     The Y coordinate of the cursor hotspot.
     *
     * @param {!Guacamole.Layer} layer
     *     The source layer containing the data which should be used as the
     *     mouse cursor image.
     *
     * @param {!number} srcx
     *     The X coordinate of the upper-left corner of the rectangle within
     *     the source layer's coordinate space to copy data from.
     *
     * @param {!number} srcy
     *     The Y coordinate of the upper-left corner of the rectangle within
     *     the source layer's coordinate space to copy data from.
     *
     * @param {!number} srcw
     *     The width of the rectangle within the source layer's coordinate
     *     space to copy data from.
     *
     * @param {!number} srch
     *     The height of the rectangle within the source layer's coordinate
     *     space to copy data from.
     */
    this.setCursor = function(hotspotX, hotspotY, layer, srcx, srcy, srcw, srch) {
        scheduleTask(function __display_set_cursor() {

            // Set hotspot
            guac_display.cursorHotspotX = hotspotX;
            guac_display.cursorHotspotY = hotspotY;

            // Reset cursor size
            cursor.resize(srcw, srch);

            // Draw cursor to cursor layer
            cursor.copy(layer, srcx, srcy, srcw, srch, 0, 0);
            guac_display.moveCursor(guac_display.cursorX, guac_display.cursorY);

            // Fire cursor change event
            if (guac_display.oncursor)
                guac_display.oncursor(cursor.toCanvas(), hotspotX, hotspotY);

        });
    };

    /**
     * Sets whether the software-rendered cursor is shown. This cursor differs
     * from the hardware cursor in that it is built into the Guacamole.Display,
     * and relies on its own Guacamole layer to render.
     *
     * @param {boolean} [shown=true]
     *     Whether to show the software cursor.
     */
    this.showCursor = function(shown) {

        var element = cursor.getElement();
        var parent = element.parentNode;

        // Remove from DOM if hidden
        if (shown === false) {
            if (parent)
                parent.removeChild(element);
        }

        // Otherwise, ensure cursor is child of display
        else if (parent !== display)
            display.appendChild(element);

    };

    /**
     * Sets the location of the local cursor to the given coordinates. For the
     * sake of responsiveness, this function performs its action immediately.
     * Cursor motion is not maintained within atomic frames.
     * 
     * @param {!number} x
     *     The X coordinate to move the cursor to.
     *
     * @param {!number} y
     *     The Y coordinate to move the cursor to.
     */
    this.moveCursor = function(x, y) {

        // Move cursor layer
        cursor.translate(x - guac_display.cursorHotspotX,
                         y - guac_display.cursorHotspotY);

        // Update stored position
        guac_display.cursorX = x;
        guac_display.cursorY = y;

    };

    /**
     * Changes the size of the given Layer to the given width and height.
     * Resizing is only attempted if the new size provided is actually different
     * from the current size.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to resize.
     *
     * @param {!number} width
     *     The new width.
     *
     * @param {!number} height
     *     The new height.
     */
    this.resize = function(layer, width, height) {
        scheduleTask(function __display_resize() {

            layer.resize(width, height);

            // Resize display if default layer is resized
            if (layer === default_layer) {

                // Update (set) display size
                displayWidth = width;
                displayHeight = height;
                display.style.width = displayWidth + "px";
                display.style.height = displayHeight + "px";

                // Update bounds size
                bounds.style.width = (displayWidth*displayScale) + "px";
                bounds.style.height = (displayHeight*displayScale) + "px";

                // Notify of resize
                if (guac_display.onresize)
                    guac_display.onresize(width, height);

            }

        });
    };

    /**
     * Draws the specified image at the given coordinates. The image specified
     * must already be loaded.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y 
     *     The destination Y coordinate.
     *
     * @param {!CanvasImageSource} image
     *     The image to draw. Note that this not a URL.
     */
    this.drawImage = function(layer, x, y, image) {
        scheduleTask(function __display_drawImage() {
            layer.drawImage(x, y, image);
        });
    };

    /**
     * Draws the image contained within the specified Blob at the given
     * coordinates. The Blob specified must already be populated with image
     * data.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     *
     * @param {!Blob} blob
     *     The Blob containing the image data to draw.
     */
    this.drawBlob = function(layer, x, y, blob) {

        var task;

        // Prefer createImageBitmap() over blob URLs if available
        if (window.createImageBitmap) {

            var bitmap;

            // Draw image once loaded
            task = scheduleTask(function drawImageBitmap() {
                layer.drawImage(x, y, bitmap);
            }, true);

            // Load image from provided blob
            window.createImageBitmap(blob).then(function bitmapLoaded(decoded) {
                bitmap = decoded;
                task.unblock();
            });

        }

        // Use blob URLs and the Image object if createImageBitmap() is
        // unavailable
        else {

            // Create URL for blob
            var url = URL.createObjectURL(blob);

            // Draw and free blob URL when ready
            task = scheduleTask(function __display_drawBlob() {

                // Draw the image only if it loaded without errors
                if (image.width && image.height)
                    layer.drawImage(x, y, image);

                // Blob URL no longer needed
                URL.revokeObjectURL(url);

            }, true);

            // Load image from URL
            var image = new Image();
            image.onload = task.unblock;
            image.onerror = task.unblock;
            image.src = url;

        }

    };

    /**
     * Draws the image within the given stream at the given coordinates. The
     * image will be loaded automatically, and this and any future operations
     * will wait for the image to finish loading. This function will
     * automatically choose an appropriate method for reading and decoding the
     * given image stream, and should be preferred for received streams except
     * where manual decoding of the stream is unavoidable.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     *
     * @param {!Guacamole.InputStream} stream
     *     The stream along which image data will be received.
     *
     * @param {!string} mimetype
     *     The mimetype of the image within the stream.
     */
    this.drawStream = function drawStream(layer, x, y, stream, mimetype) {

        // Leverage ImageDecoder to decode the image stream as it is received
        // whenever possible, as this reduces latency that might otherwise be
        // caused by waiting for the full image to be received
        if (window.ImageDecoder && window.ReadableStream) {

            var imageDecoder = new ImageDecoder({
                type: mimetype,
                data: stream.toReadableStream()
            });

            var decodedFrame = null;

            // Draw image once loaded
            var task = scheduleTask(function drawImageBitmap() {
                layer.drawImage(x, y, decodedFrame);
            }, true);

            imageDecoder.decode({ completeFramesOnly: true }).then(function bitmapLoaded(result) {
                decodedFrame = result.image;
                task.unblock();
            });

        }

        // NOTE: We do not use Blobs and createImageBitmap() here, as doing so
        // is very latent compared to the old data URI method and the new
        // ImageDecoder object. The new ImageDecoder object is currently
        // supported by most browsers, with other browsers being much faster if
        // data URIs are used. The iOS version of Safari is particularly laggy
        // if Blobs and createImageBitmap() are used instead.

        // Lacking ImageDecoder, fall back to data URIs and the Image object
        else {
            var reader = new Guacamole.DataURIReader(stream, mimetype);
            reader.onend = function drawImageDataURI() {
                guac_display.draw(layer, x, y, reader.getURI());
            };
        }

    };

    /**
     * Draws the image at the specified URL at the given coordinates. The image
     * will be loaded automatically, and this and any future operations will
     * wait for the image to finish loading.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     *
     * @param {!string} url
     *     The URL of the image to draw.
     */
    this.draw = function(layer, x, y, url) {

        var task = scheduleTask(function __display_draw() {

            // Draw the image only if it loaded without errors
            if (image.width && image.height)
                layer.drawImage(x, y, image);

        }, true);

        var image = new Image();
        image.onload = task.unblock;
        image.onerror = task.unblock;
        image.src = url;

    };

    /**
     * Plays the video at the specified URL within this layer. The video
     * will be loaded automatically, and this and any future operations will
     * wait for the video to finish loading. Future operations will not be
     * executed until the video finishes playing.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!string} mimetype
     *     The mimetype of the video to play.
     *
     * @param {!number} duration
     *     The duration of the video in milliseconds.
     *
     * @param {!string} url
     *     The URL of the video to play.
     */
    this.play = function(layer, mimetype, duration, url) {

        // Start loading the video
        var video = document.createElement("video");
        video.type = mimetype;
        video.src = url;

        // Start copying frames when playing
        video.addEventListener("play", function() {
            
            function render_callback() {
                layer.drawImage(0, 0, video);
                if (!video.ended)
                    window.setTimeout(render_callback, 20);
            }
            
            render_callback();
            
        }, false);

        scheduleTask(video.play);

    };

    /**
     * Transfer a rectangle of image data from one Layer to this Layer using the
     * specified transfer function.
     * 
     * @param {!Guacamole.Layer} srcLayer
     *     The Layer to copy image data from.
     *
     * @param {!number} srcx
     *     The X coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcy
     *     The Y coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcw
     *     The width of the rectangle within the source Layer's coordinate
     *     space to copy data from.
     *
     * @param {!number} srch
     *     The height of the rectangle within the source Layer's coordinate
     *     space to copy data from.
     *
     * @param {!Guacamole.Layer} dstLayer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     *
     * @param {!function} transferFunction
     *     The transfer function to use to transfer data from source to
     *     destination.
     */
    this.transfer = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y, transferFunction) {
        scheduleTask(function __display_transfer() {
            dstLayer.transfer(srcLayer, srcx, srcy, srcw, srch, x, y, transferFunction);
        });
    };

    /**
     * Put a rectangle of image data from one Layer to this Layer directly
     * without performing any alpha blending. Simply copy the data.
     * 
     * @param {!Guacamole.Layer} srcLayer
     *     The Layer to copy image data from.
     *
     * @param {!number} srcx
     *     The X coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcy
     *     The Y coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcw
     *     The width of the rectangle within the source Layer's coordinate
     *     space to copy data from.
     *
     * @param {!number} srch
     *     The height of the rectangle within the source Layer's coordinate
     *     space to copy data from.
     *
     * @param {!Guacamole.Layer} dstLayer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     */
    this.put = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y) {
        scheduleTask(function __display_put() {
            dstLayer.put(srcLayer, srcx, srcy, srcw, srch, x, y);
        });
    };

    /**
     * Copy a rectangle of image data from one Layer to this Layer. This
     * operation will copy exactly the image data that will be drawn once all
     * operations of the source Layer that were pending at the time this
     * function was called are complete. This operation will not alter the
     * size of the source Layer even if its autosize property is set to true.
     * 
     * @param {!Guacamole.Layer} srcLayer
     *     The Layer to copy image data from.
     *
     * @param {!number} srcx
     *     The X coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcy
     *     The Y coordinate of the upper-left corner of the rectangle within
     *     the source Layer's coordinate space to copy data from.
     *
     * @param {!number} srcw
     *     The width of the rectangle within the source Layer's coordinate
     *     space to copy data from.
     *
     * @param {!number} srch
     *     The height of the rectangle within the source Layer's coordinate space to copy data from.
     *
     * @param {!Guacamole.Layer} dstLayer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The destination X coordinate.
     *
     * @param {!number} y
     *     The destination Y coordinate.
     */
    this.copy = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y) {
        scheduleTask(function __display_copy() {
            dstLayer.copy(srcLayer, srcx, srcy, srcw, srch, x, y);
        });
    };

    /**
     * Starts a new path at the specified point.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The X coordinate of the point to draw.
     *
     * @param {!number} y
     *     The Y coordinate of the point to draw.
     */
    this.moveTo = function(layer, x, y) {
        scheduleTask(function __display_moveTo() {
            layer.moveTo(x, y);
        });
    };

    /**
     * Add the specified line to the current path.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The X coordinate of the endpoint of the line to draw.
     *
     * @param {!number} y
     *     The Y coordinate of the endpoint of the line to draw.
     */
    this.lineTo = function(layer, x, y) {
        scheduleTask(function __display_lineTo() {
            layer.lineTo(x, y);
        });
    };

    /**
     * Add the specified arc to the current path.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The X coordinate of the center of the circle which will contain the
     *     arc.
     *
     * @param {!number} y
     *     The Y coordinate of the center of the circle which will contain the
     *     arc.
     *
     * @param {!number} radius
     *     The radius of the circle.
     *
     * @param {!number} startAngle
     *     The starting angle of the arc, in radians.
     *
     * @param {!number} endAngle
     *     The ending angle of the arc, in radians.
     *
     * @param {!boolean} negative
     *     Whether the arc should be drawn in order of decreasing angle.
     */
    this.arc = function(layer, x, y, radius, startAngle, endAngle, negative) {
        scheduleTask(function __display_arc() {
            layer.arc(x, y, radius, startAngle, endAngle, negative);
        });
    };

    /**
     * Starts a new path at the specified point.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} cp1x
     *     The X coordinate of the first control point.
     *
     * @param {!number} cp1y
     *     The Y coordinate of the first control point.
     *
     * @param {!number} cp2x
     *     The X coordinate of the second control point.
     *
     * @param {!number} cp2y
     *     The Y coordinate of the second control point.
     *
     * @param {!number} x
     *     The X coordinate of the endpoint of the curve.
     *
     * @param {!number} y
     *     The Y coordinate of the endpoint of the curve.
     */
    this.curveTo = function(layer, cp1x, cp1y, cp2x, cp2y, x, y) {
        scheduleTask(function __display_curveTo() {
            layer.curveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        });
    };

    /**
     * Closes the current path by connecting the end point with the start
     * point (if any) with a straight line.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     */
    this.close = function(layer) {
        scheduleTask(function __display_close() {
            layer.close();
        });
    };

    /**
     * Add the specified rectangle to the current path.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} x
     *     The X coordinate of the upper-left corner of the rectangle to draw.
     *
     * @param {!number} y
     *     The Y coordinate of the upper-left corner of the rectangle to draw.
     *
     * @param {!number} w
     *     The width of the rectangle to draw.
     *
     * @param {!number} h
     *     The height of the rectangle to draw.
     */
    this.rect = function(layer, x, y, w, h) {
        scheduleTask(function __display_rect() {
            layer.rect(x, y, w, h);
        });
    };

    /**
     * Clip all future drawing operations by the current path. The current path
     * is implicitly closed. The current path can continue to be reused
     * for other operations (such as fillColor()) but a new path will be started
     * once a path drawing operation (path() or rect()) is used.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to affect.
     */
    this.clip = function(layer) {
        scheduleTask(function __display_clip() {
            layer.clip();
        });
    };

    /**
     * Stroke the current path with the specified color. The current path
     * is implicitly closed. The current path can continue to be reused
     * for other operations (such as clip()) but a new path will be started
     * once a path drawing operation (path() or rect()) is used.
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!string} cap
     *     The line cap style. Can be "round", "square", or "butt".
     *
     * @param {!string} join
     *     The line join style. Can be "round", "bevel", or "miter".
     *
     * @param {!number} thickness
     *     The line thickness in pixels.
     *
     * @param {!number} r
     *     The red component of the color to fill.
     *
     * @param {!number} g
     *     The green component of the color to fill.
     *
     * @param {!number} b
     *     The blue component of the color to fill.
     *
     * @param {!number} a
     *     The alpha component of the color to fill.
     */
    this.strokeColor = function(layer, cap, join, thickness, r, g, b, a) {
        scheduleTask(function __display_strokeColor() {
            layer.strokeColor(cap, join, thickness, r, g, b, a);
        });
    };

    /**
     * Fills the current path with the specified color. The current path
     * is implicitly closed. The current path can continue to be reused
     * for other operations (such as clip()) but a new path will be started
     * once a path drawing operation (path() or rect()) is used.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!number} r
     *     The red component of the color to fill.
     *
     * @param {!number} g
     *     The green component of the color to fill.
     *
     * @param {!number} b
     *     The blue component of the color to fill.
     *
     * @param {!number} a
     *     The alpha component of the color to fill.
     */
    this.fillColor = function(layer, r, g, b, a) {
        scheduleTask(function __display_fillColor() {
            layer.fillColor(r, g, b, a);
        });
    };

    /**
     * Stroke the current path with the image within the specified layer. The
     * image data will be tiled infinitely within the stroke. The current path
     * is implicitly closed. The current path can continue to be reused
     * for other operations (such as clip()) but a new path will be started
     * once a path drawing operation (path() or rect()) is used.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!string} cap
     *     The line cap style. Can be "round", "square", or "butt".
     *
     * @param {!string} join
     *     The line join style. Can be "round", "bevel", or "miter".
     *
     * @param {!number} thickness
     *     The line thickness in pixels.
     *
     * @param {!Guacamole.Layer} srcLayer
     *     The layer to use as a repeating pattern within the stroke.
     */
    this.strokeLayer = function(layer, cap, join, thickness, srcLayer) {
        scheduleTask(function __display_strokeLayer() {
            layer.strokeLayer(cap, join, thickness, srcLayer);
        });
    };

    /**
     * Fills the current path with the image within the specified layer. The
     * image data will be tiled infinitely within the stroke. The current path
     * is implicitly closed. The current path can continue to be reused
     * for other operations (such as clip()) but a new path will be started
     * once a path drawing operation (path() or rect()) is used.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     *
     * @param {!Guacamole.Layer} srcLayer
     *     The layer to use as a repeating pattern within the fill.
     */
    this.fillLayer = function(layer, srcLayer) {
        scheduleTask(function __display_fillLayer() {
            layer.fillLayer(srcLayer);
        });
    };

    /**
     * Push current layer state onto stack.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     */
    this.push = function(layer) {
        scheduleTask(function __display_push() {
            layer.push();
        });
    };

    /**
     * Pop layer state off stack.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     */
    this.pop = function(layer) {
        scheduleTask(function __display_pop() {
            layer.pop();
        });
    };

    /**
     * Reset the layer, clearing the stack, the current path, and any transform
     * matrix.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to draw upon.
     */
    this.reset = function(layer) {
        scheduleTask(function __display_reset() {
            layer.reset();
        });
    };

    /**
     * Sets the given affine transform (defined with six values from the
     * transform's matrix).
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to modify.
     *
     * @param {!number} a
     *     The first value in the affine transform's matrix.
     *
     * @param {!number} b
     *     The second value in the affine transform's matrix.
     *
     * @param {!number} c
     *     The third value in the affine transform's matrix.
     *
     * @param {!number} d
     *     The fourth value in the affine transform's matrix.
     *
     * @param {!number} e
     *     The fifth value in the affine transform's matrix.
     *
     * @param {!number} f
     *     The sixth value in the affine transform's matrix.
     */
    this.setTransform = function(layer, a, b, c, d, e, f) {
        scheduleTask(function __display_setTransform() {
            layer.setTransform(a, b, c, d, e, f);
        });
    };

    /**
     * Applies the given affine transform (defined with six values from the
     * transform's matrix).
     *
     * @param {!Guacamole.Layer} layer
     *     The layer to modify.
     *
     * @param {!number} a
     *     The first value in the affine transform's matrix.
     *
     * @param {!number} b
     *     The second value in the affine transform's matrix.
     *
     * @param {!number} c
     *     The third value in the affine transform's matrix.
     *
     * @param {!number} d
     *     The fourth value in the affine transform's matrix.
     *
     * @param {!number} e
     *     The fifth value in the affine transform's matrix.
     *
     * @param {!number} f
     *     The sixth value in the affine transform's matrix.
     *
     */
    this.transform = function(layer, a, b, c, d, e, f) {
        scheduleTask(function __display_transform() {
            layer.transform(a, b, c, d, e, f);
        });
    };

    /**
     * Sets the channel mask for future operations on this Layer.
     * 
     * The channel mask is a Guacamole-specific compositing operation identifier
     * with a single bit representing each of four channels (in order): source
     * image where destination transparent, source where destination opaque,
     * destination where source transparent, and destination where source
     * opaque.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to modify.
     *
     * @param {!number} mask
     *     The channel mask for future operations on this Layer.
     */
    this.setChannelMask = function(layer, mask) {
        scheduleTask(function __display_setChannelMask() {
            layer.setChannelMask(mask);
        });
    };

    /**
     * Sets the miter limit for stroke operations using the miter join. This
     * limit is the maximum ratio of the size of the miter join to the stroke
     * width. If this ratio is exceeded, the miter will not be drawn for that
     * joint of the path.
     * 
     * @param {!Guacamole.Layer} layer
     *     The layer to modify.
     *
     * @param {!number} limit
     *     The miter limit for stroke operations using the miter join.
     */
    this.setMiterLimit = function(layer, limit) {
        scheduleTask(function __display_setMiterLimit() {
            layer.setMiterLimit(limit);
        });
    };

    /**
     * Removes the given layer container entirely, such that it is no longer
     * contained within its parent layer, if any.
     *
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The layer being removed from its parent.
     */
    this.dispose = function dispose(layer) {
        scheduleTask(function disposeLayer() {
            layer.dispose();
        });
    };

    /**
     * Applies the given affine transform (defined with six values from the
     * transform's matrix) to the given layer.
     *
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The layer being distorted.
     *
     * @param {!number} a
     *     The first value in the affine transform's matrix.
     *
     * @param {!number} b
     *     The second value in the affine transform's matrix.
     *
     * @param {!number} c
     *     The third value in the affine transform's matrix.
     *
     * @param {!number} d
     *     The fourth value in the affine transform's matrix.
     *
     * @param {!number} e
     *     The fifth value in the affine transform's matrix.
     *
     * @param {!number} f
     *     The sixth value in the affine transform's matrix.
     */
    this.distort = function distort(layer, a, b, c, d, e, f) {
        scheduleTask(function distortLayer() {
            layer.distort(a, b, c, d, e, f);
        });
    };

    /**
     * Moves the upper-left corner of the given layer to the given X and Y
     * coordinate, sets the Z stacking order, and reparents the layer
     * to the given parent layer.
     *
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The layer being moved.
     *
     * @param {!Guacamole.Display.VisibleLayer} parent
     *     The parent to set.
     *
     * @param {!number} x
     *     The X coordinate to move to.
     *
     * @param {!number} y
     *     The Y coordinate to move to.
     *
     * @param {!number} z
     *     The Z coordinate to move to.
     */
    this.move = function move(layer, parent, x, y, z) {
        scheduleTask(function moveLayer() {
            layer.move(parent, x, y, z);
        });
    };

    /**
     * Sets the opacity of the given layer to the given value, where 255 is
     * fully opaque and 0 is fully transparent.
     *
     * @param {!Guacamole.Display.VisibleLayer} layer
     *     The layer whose opacity should be set.
     *
     * @param {!number} alpha
     *     The opacity to set.
     */
    this.shade = function shade(layer, alpha) {
        scheduleTask(function shadeLayer() {
            layer.shade(alpha);
        });
    };

    /**
     * Sets the scale of the client display element such that it renders at
     * a relatively smaller or larger size, without affecting the true
     * resolution of the display.
     *
     * @param {!number} scale
     *     The scale to resize to, where 1.0 is normal size (1:1 scale).
     */
    this.scale = function(scale) {

        display.style.transform =
        display.style.WebkitTransform =
        display.style.MozTransform =
        display.style.OTransform =
        display.style.msTransform =

            "scale(" + scale + "," + scale + ")";

        displayScale = scale;

        // Update bounds size
        bounds.style.width = (displayWidth*displayScale) + "px";
        bounds.style.height = (displayHeight*displayScale) + "px";

    };

    /**
     * Returns the scale of the display.
     *
     * @return {!number}
     *     The scale of the display.
     */
    this.getScale = function() {
        return displayScale;
    };

    /**
     * Returns a canvas element containing the entire display, with all child
     * layers composited within.
     *
     * @return {!HTMLCanvasElement}
     *     A new canvas element containing a copy of the display.
     */
    this.flatten = function() {
       
        // Get destination canvas
        var canvas = document.createElement("canvas");
        canvas.width = default_layer.width;
        canvas.height = default_layer.height;

        var context = canvas.getContext("2d");

        // Returns sorted array of children
        function get_children(layer) {

            // Build array of children
            var children = [];
            for (var index in layer.children)
                children.push(layer.children[index]);

            // Sort
            children.sort(function children_comparator(a, b) {

                // Compare based on Z order
                var diff = a.z - b.z;
                if (diff !== 0)
                    return diff;

                // If Z order identical, use document order
                var a_element = a.getElement();
                var b_element = b.getElement();
                var position = b_element.compareDocumentPosition(a_element);

                if (position & Node.DOCUMENT_POSITION_PRECEDING) return -1;
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) return  1;

                // Otherwise, assume same
                return 0;

            });

            // Done
            return children;

        }

        // Draws the contents of the given layer at the given coordinates
        function draw_layer(layer, x, y) {

            // Draw layer
            if (layer.width > 0 && layer.height > 0) {

                // Save and update alpha
                var initial_alpha = context.globalAlpha;
                context.globalAlpha *= layer.alpha / 255.0;

                // Copy data
                context.drawImage(layer.getCanvas(), x, y);

                // Draw all children
                var children = get_children(layer);
                for (var i=0; i<children.length; i++) {
                    var child = children[i];
                    draw_layer(child, x + child.x, y + child.y);
                }

                // Restore alpha
                context.globalAlpha = initial_alpha;

            }

        }

        // Draw default layer and all children
        draw_layer(default_layer, 0, 0);

        // Return new canvas copy
        return canvas;
        
    };

};

/**
 * Simple container for Guacamole.Layer, allowing layers to be easily
 * repositioned and nested. This allows certain operations to be accelerated
 * through DOM manipulation, rather than raster operations.
 * 
 * @constructor
 * @augments Guacamole.Layer
 * @param {!number} width
 *     The width of the Layer, in pixels. The canvas element backing this Layer
 *     will be given this width.
 *
 * @param {!number} height
 *     The height of the Layer, in pixels. The canvas element backing this
 *     Layer will be given this height.
 */
Guacamole.Display.VisibleLayer = function(width, height) {

    Guacamole.Layer.apply(this, [width, height]);

    /**
     * Reference to this layer.
     *
     * @private
     * @type {!Guacamole.Display.Layer}
     */
    var layer = this;

    /**
     * Identifier which uniquely identifies this layer. This is COMPLETELY
     * UNRELATED to the index of the underlying layer, which is specific
     * to the Guacamole protocol, and not relevant at this level.
     * 
     * @private
     * @type {!number}
     */
    this.__unique_id = Guacamole.Display.VisibleLayer.__next_id++;

    /**
     * The opacity of the layer container, where 255 is fully opaque and 0 is
     * fully transparent.
     *
     * @type {!number}
     */
    this.alpha = 0xFF;

    /**
     * X coordinate of the upper-left corner of this layer container within
     * its parent, in pixels.
     *
     * @type {!number}
     */
    this.x = 0;

    /**
     * Y coordinate of the upper-left corner of this layer container within
     * its parent, in pixels.
     *
     * @type {!number}
     */
    this.y = 0;

    /**
     * Z stacking order of this layer relative to other sibling layers.
     *
     * @type {!number}
     */
    this.z = 0;

    /**
     * The affine transformation applied to this layer container. Each element
     * corresponds to a value from the transformation matrix, with the first
     * three values being the first row, and the last three values being the
     * second row. There are six values total.
     * 
     * @type {!number[]}
     */
    this.matrix = [1, 0, 0, 1, 0, 0];

    /**
     * The parent layer container of this layer, if any.
     * @type {Guacamole.Display.VisibleLayer}
     */
    this.parent = null;

    /**
     * Set of all children of this layer, indexed by layer index. This object
     * will have one property per child.
     *
     * @type {!Object.<number, Guacamole.Display.VisibleLayer>}
     */
    this.children = {};

    // Set layer position
    var canvas = layer.getCanvas();
    canvas.style.position = "absolute";
    canvas.style.left = "0px";
    canvas.style.top = "0px";

    // Create div with given size
    var div = document.createElement("div");
    div.appendChild(canvas);
    div.style.width = width + "px";
    div.style.height = height + "px";
    div.style.position = "absolute";
    div.style.left = "0px";
    div.style.top = "0px";
    div.style.overflow = "hidden";

    /**
     * Superclass resize() function.
     * @private
     */
    var __super_resize = this.resize;

    this.resize = function(width, height) {

        // Resize containing div
        div.style.width = width + "px";
        div.style.height = height + "px";

        __super_resize(width, height);

    };
  
    /**
     * Returns the element containing the canvas and any other elements
     * associated with this layer.
     *
     * @returns {!Element}
     *     The element containing this layer's canvas.
     */
    this.getElement = function() {
        return div;
    };

    /**
     * The translation component of this layer's transform.
     *
     * @private
     * @type {!string}
     */
    var translate = "translate(0px, 0px)"; // (0, 0)

    /**
     * The arbitrary matrix component of this layer's transform.
     *
     * @private
     * @type {!string}
     */
    var matrix = "matrix(1, 0, 0, 1, 0, 0)"; // Identity

    /**
     * Moves the upper-left corner of this layer to the given X and Y
     * coordinate.
     * 
     * @param {!number} x
     *     The X coordinate to move to.
     *
     * @param {!number} y
     *     The Y coordinate to move to.
     */
    this.translate = function(x, y) {

        layer.x = x;
        layer.y = y;

        // Generate translation
        translate = "translate("
                        + x + "px,"
                        + y + "px)";

        // Set layer transform 
        div.style.transform =
        div.style.WebkitTransform =
        div.style.MozTransform =
        div.style.OTransform =
        div.style.msTransform =

            translate + " " + matrix;

    };

    /**
     * Moves the upper-left corner of this VisibleLayer to the given X and Y
     * coordinate, sets the Z stacking order, and reparents this VisibleLayer
     * to the given VisibleLayer.
     * 
     * @param {!Guacamole.Display.VisibleLayer} parent
     *     The parent to set.
     *
     * @param {!number} x
     *     The X coordinate to move to.
     *
     * @param {!number} y
     *     The Y coordinate to move to.
     *
     * @param {!number} z
     *     The Z coordinate to move to.
     */
    this.move = function(parent, x, y, z) {

        // Set parent if necessary
        if (layer.parent !== parent) {

            // Maintain relationship
            if (layer.parent)
                delete layer.parent.children[layer.__unique_id];
            layer.parent = parent;
            parent.children[layer.__unique_id] = layer;

            // Reparent element
            var parent_element = parent.getElement();
            parent_element.appendChild(div);

        }

        // Set location
        layer.translate(x, y);
        layer.z = z;
        div.style.zIndex = z;

    };

    /**
     * Sets the opacity of this layer to the given value, where 255 is fully
     * opaque and 0 is fully transparent.
     * 
     * @param {!number} a
     *     The opacity to set.
     */
    this.shade = function(a) {
        layer.alpha = a;
        div.style.opacity = a/255.0;
    };

    /**
     * Removes this layer container entirely, such that it is no longer
     * contained within its parent layer, if any.
     */
    this.dispose = function() {

        // Remove from parent container
        if (layer.parent) {
            delete layer.parent.children[layer.__unique_id];
            layer.parent = null;
        }

        // Remove from parent element
        if (div.parentNode)
            div.parentNode.removeChild(div);
        
    };

    /**
     * Applies the given affine transform (defined with six values from the
     * transform's matrix).
     *
     * @param {!number} a
     *     The first value in the affine transform's matrix.
     *
     * @param {!number} b
     *     The second value in the affine transform's matrix.
     *
     * @param {!number} c
     *     The third value in the affine transform's matrix.
     *
     * @param {!number} d
     *     The fourth value in the affine transform's matrix.
     *
     * @param {!number} e
     *     The fifth value in the affine transform's matrix.
     *
     * @param {!number} f
     *     The sixth value in the affine transform's matrix.
     */
    this.distort = function(a, b, c, d, e, f) {

        // Store matrix
        layer.matrix = [a, b, c, d, e, f];

        // Generate matrix transformation
        matrix =

            /* a c e
             * b d f
             * 0 0 1
             */
    
            "matrix(" + a + "," + b + "," + c + "," + d + "," + e + "," + f + ")";

        // Set layer transform 
        div.style.transform =
        div.style.WebkitTransform =
        div.style.MozTransform =
        div.style.OTransform =
        div.style.msTransform =

            translate + " " + matrix;

    };

};

/**
 * The next identifier to be assigned to the layer container. This identifier
 * uniquely identifies each VisibleLayer, but is unrelated to the index of
 * the layer, which exists at the protocol/client level only.
 * 
 * @private
 * @type {!number}
 */
Guacamole.Display.VisibleLayer.__next_id = 0;

/**
 * A set of Guacamole display performance statistics, describing the speed at
 * which the remote desktop, Guacamole server, and Guacamole client are
 * rendering frames.
 *
 * @constructor
 * @param {Guacamole.Display.Statistics|Object} [template={}]
 *     The object whose properties should be copied within the new
 *     Guacamole.Display.Statistics.
 */
Guacamole.Display.Statistics = function Statistics(template) {

    template = template || {};

    /**
     * The amount of time that the Guacamole client is taking to render
     * individual frames, in milliseconds, if known. If this value is unknown,
     * such as if the there are insufficient frame statistics recorded to
     * calculate this value, this will be null.
     *
     * @type {?number}
     */
    this.processingLag = template.processingLag;

    /**
     * The framerate of the remote desktop currently being viewed within the
     * relevant Gucamole.Display, independent of Guacamole, in frames per
     * second. This represents the speed at which the remote desktop is
     * producing frame data for the Guacamole server to consume. If this
     * value is unknown, such as if the remote desktop server does not actually
     * define frame boundaries, this will be null.
     *
     * @type {?number}
     */
    this.desktopFps = template.desktopFps;

    /**
     * The rate at which the Guacamole server is generating frames for the
     * Guacamole client to consume, in frames per second. If the Guacamole
     * server is correctly adjusting for variance in client/browser processing
     * power, this rate should closely match the client rate, and should remain
     * independent of any network latency. If this value is unknown, such as if
     * the there are insufficient frame statistics recorded to calculate this
     * value, this will be null.
     *
     * @type {?number}
     */
    this.serverFps = template.serverFps;

    /**
     * The rate at which the Guacamole client is consuming frames generated by
     * the Guacamole server, in frames per second. If the Guacamole server is
     * correctly adjusting for variance in client/browser processing power,
     * this rate should closely match the server rate, regardless of any
     * latency on the network between the server and client. If this value is
     * unknown, such as if the there are insufficient frame statistics recorded
     * to calculate this value, this will be null.
     *
     * @type {?number}
     */
    this.clientFps = template.clientFps;

    /**
     * The rate at which the Guacamole server is dropping or combining frames
     * received from the remote desktop server to compensate for variance in
     * client/browser processing power, in frames per second. This value may
     * also be non-zero if the server is compensating for variances in its own
     * processing power, or relative slowness in image compression vs. the rate
     * that inbound frames are received. If this value is unknown, such as if
     * the remote desktop server does not actually define frame boundaries,
     * this will be null.
     */
    this.dropRate = template.dropRate;

};
