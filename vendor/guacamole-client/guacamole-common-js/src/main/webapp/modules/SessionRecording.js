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
 * A recording of a Guacamole session. Given a {@link Guacamole.Tunnel} or Blob,
 * the Guacamole.SessionRecording automatically parses Guacamole instructions
 * within the recording source as it plays back the recording. Playback of the
 * recording may be controlled through function calls to the
 * Guacamole.SessionRecording, even while the recording has not yet finished
 * being created or downloaded. Parsing of the contents of the recording will
 * begin immediately and automatically after this constructor is invoked.
 *
 * @constructor
 * @param {!Blob|Guacamole.Tunnel} source
 *     The Blob from which the instructions of the recording should
 *     be read.
 * @param {number} [refreshInterval=1000]
 *     The minimum number of milliseconds between updates to the recording
 *     position through the provided onseek() callback. If non-positive, this
 *     parameter will be ignored, and the recording position will only be
 *     updated when seek requests are made, or when new frames are rendered.
 *     If not specified, refreshInterval will default to 1000 milliseconds.
 */
Guacamole.SessionRecording = function SessionRecording(source, refreshInterval) {

    // Default the refresh interval to 1 second if not specified otherwise
    if (refreshInterval === undefined)
        refreshInterval = 1000;

    /**
     * Reference to this Guacamole.SessionRecording.
     *
     * @private
     * @type {!Guacamole.SessionRecording}
     */
    var recording = this;

    /**
     * The Blob from which the instructions of the recording should be read.
     * Note that this value is initialized far below.
     *
     * @private
     * @type {!Blob}
     */
    var recordingBlob;

    /**
     * The tunnel from which the recording should be read, if the recording is
     * being read from a tunnel. If the recording was supplied as a Blob, this
     * will be null.
     *
     * @private
     * @type {Guacamole.Tunnel}
     */
    var tunnel = null;

    /**
     * The number of bytes that this Guacamole.SessionRecording should attempt
     * to read from the given blob in each read operation. Larger blocks will
     * generally read the blob more quickly, but may result in excessive
     * time being spent within the parser, making the page unresponsive
     * while the recording is loading.
     *
     * @private
     * @constant
     * @type {Number}
     */
    var BLOCK_SIZE = 262144;

    /**
     * The minimum number of characters which must have been read between
     * keyframes.
     *
     * @private
     * @constant
     * @type {Number}
     */
    var KEYFRAME_CHAR_INTERVAL = 16384;

    /**
     * The minimum number of milliseconds which must elapse between keyframes.
     *
     * @private
     * @constant
     * @type {Number}
     */
    var KEYFRAME_TIME_INTERVAL = 5000;

    /**
     * All frames parsed from the provided blob.
     *
     * @private
     * @type {!Guacamole.SessionRecording._Frame[]}
     */
    var frames = [];

    /**
     * The timestamp of the last frame which was flagged for use as a keyframe.
     * If no timestamp has yet been flagged, this will be 0.
     *
     * @private
     * @type {!number}
     */
    var lastKeyframe = 0;

    /**
     * Tunnel which feeds arbitrary instructions to the client used by this
     * Guacamole.SessionRecording for playback of the session recording.
     *
     * @private
     * @type {!Guacamole.SessionRecording._PlaybackTunnel}
     */
    var playbackTunnel = new Guacamole.SessionRecording._PlaybackTunnel();

    /**
     * Guacamole.Client instance used for visible playback of the session
     * recording.
     *
     * @private
     * @type {!Guacamole.Client}
     */
    var playbackClient = new Guacamole.Client(playbackTunnel);

    /**
     * The current frame rendered within the playback client. If no frame is
     * yet rendered, this will be -1.
     *
     * @private
     * @type {!number}
     */
    var currentFrame = -1;

    /**
     * The position of the recording when playback began, in milliseconds. If
     * playback is not in progress, this will be null.
     *
     * @private
     * @type {number}
     */
    var startVideoPosition = null;

    /**
     * The real-world timestamp when playback began, in milliseconds. If
     * playback is not in progress, this will be null.
     *
     * @private
     * @type {number}
     */
    var startRealTimestamp = null;

    /**
     * The current position within the recording, in milliseconds.
     *
     * @private
     * @type {!number}
     */
    var currentPosition = 0;

    /**
     * An object containing a single "aborted" property which is set to
     * true if the in-progress seek operation should be aborted. If no seek
     * operation is in progress, this will be null.
     *
     * @private
     * @type {object}
     */
    var activeSeek = null;

    /**
     * The byte offset within the recording blob of the first character of
     * the first instruction of the current frame. Here, "current frame"
     * refers to the frame currently being parsed when the provided
     * recording is initially loading. If the recording is not being
     * loaded, this value has no meaning.
     *
     * @private
     * @type {!number}
     */
    var frameStart = 0;

    /**
     * The byte offset within the recording blob of the character which
     * follows the last character of the most recently parsed instruction
     * of the current frame. Here, "current frame" refers to the frame
     * currently being parsed when the provided recording is initially
     * loading. If the recording is not being loaded, this value has no
     * meaning.
     *
     * @private
     * @type {!number}
     */
    var frameEnd = 0;

    /**
     * Whether the initial loading process has been aborted. If the loading
     * process has been aborted, no further blocks of data should be read
     * from the recording.
     *
     * @private
     * @type {!boolean}
     */
    var aborted = false;

    /**
     * The function to invoke when the seek operation initiated by a call
     * to seek() is cancelled or successfully completed. If no seek
     * operation is in progress, this will be null.
     *
     * @private
     * @type {function}
     */
    var seekCallback = null;

    /**
     * Any current timeout associated with scheduling frame replay, or updating
     * the current position, or null if no frame position increment is currently
     * scheduled.
     *
     * @private
     * @type {number}
     */
    var updateTimeout = null;

    /**
     * The browser timestamp of the last time that currentPosition was updated
     * while playing, or null if the recording is not currently playing.
     *
     * @private
     * @type {number}
     */
    var lastUpdateTimestamp = null;

    /**
     * Parses all Guacamole instructions within the given blob, invoking
     * the provided instruction callback for each such instruction. Once
     * the end of the blob has been reached (no instructions remain to be
     * parsed), the provided completion callback is invoked. If a parse
     * error prevents reading instructions from the blob, the onerror
     * callback of the Guacamole.SessionRecording is invoked, and no further
     * data is handled within the blob.
     *
     * @private
     * @param {!Blob} blob
     *     The blob to parse Guacamole instructions from.
     *
     * @param {function} [instructionCallback]
     *     The callback to invoke for each Guacamole instruction read from
     *     the given blob. This function must accept the same arguments
     *     as the oninstruction handler of Guacamole.Parser.
     *
     * @param {function} [completionCallback]
     *     The callback to invoke once all instructions have been read from
     *     the given blob.
     */
    var parseBlob = function parseBlob(blob, instructionCallback, completionCallback) {

        // Do not read any further blocks if loading has been aborted
        if (aborted && blob === recordingBlob)
            return;

        // Prepare a parser to handle all instruction data within the blob,
        // automatically invoking the provided instruction callback for all
        // parsed instructions
        var parser = new Guacamole.Parser();
        parser.oninstruction = instructionCallback;

        var offset = 0;
        var reader = new FileReader();

        /**
         * Reads the block of data at offset bytes within the blob. If no
         * such block exists, then the completion callback provided to
         * parseBlob() is invoked as all data has been read.
         *
         * @private
         */
        var readNextBlock = function readNextBlock() {

            // Do not read any further blocks if loading has been aborted
            if (aborted && blob === recordingBlob)
                return;

            // Parse all instructions within the block, invoking the
            // onerror handler if a parse error occurs
            if (reader.readyState === 2 /* DONE */) {
                try {
                    parser.receive(reader.result);
                }
                catch (parseError) {
                    if (recording.onerror) {
                        recording.onerror(parseError.message);
                    }
                    return;
                }
            }

            // If no data remains, the read operation is complete and no
            // further blocks need to be read
            if (offset >= blob.size) {
                if (completionCallback)
                    completionCallback();
            }

            // Otherwise, read the next block
            else {
                var block = blob.slice(offset, offset + BLOCK_SIZE);
                offset += block.size;
                reader.readAsText(block);
            }

        };

        // Read blocks until the end of the given blob is reached
        reader.onload = readNextBlock;
        readNextBlock();

    };

    /**
     * Calculates the size of the given Guacamole instruction element, in
     * Unicode characters. The size returned includes the characters which
     * make up the length, the "." separator between the length and the
     * element itself, and the "," or ";" terminator which follows the
     * element.
     *
     * @private
     * @param {!string} value
     *     The value of the element which has already been parsed (lacks
     *     the initial length, "." separator, and "," or ";" terminator).
     *
     * @returns {!number}
     *     The number of Unicode characters which would make up the given
     *     element within a Guacamole instruction.
     */
    var getElementSize = function getElementSize(value) {

        var valueLength = value.length;

        // Calculate base size, assuming at least one digit, the "."
        // separator, and the "," or ";" terminator
        var protocolSize = valueLength + 3;

        // Add one character for each additional digit that would occur
        // in the element length prefix
        while (valueLength >= 10) {
            protocolSize++;
            valueLength = Math.floor(valueLength / 10);
        }

        return protocolSize;

    };

    // Start playback client connected
    playbackClient.connect();

    // Hide cursor unless mouse position is received
    playbackClient.getDisplay().showCursor(false);

    /**
     * A key event interpreter to split all key events in this recording into
     * human-readable batches of text. Constrcution is deferred until the first
     * event is processed, to enable recording-relative timestamps.
     *
     * @type {!Guacamole.KeyEventInterpreter}
     */
    var keyEventInterpreter = null;

    /**
     * Initialize the key interpreter. This function should be called only once
     * with the first timestamp in the recording as an argument.
     *
     * @private
     * @param {!number} startTimestamp
     *     The timestamp of the first frame in the recording, i.e. the start of
     *     the recording.
     */
    function initializeKeyInterpreter(startTimestamp) {
        keyEventInterpreter = new Guacamole.KeyEventInterpreter(startTimestamp);
    }

    /**
     * Handles a newly-received instruction, whether from the main Blob or a
     * tunnel, adding new frames and keyframes as necessary. Load progress is
     * reported via onprogress automatically.
     *
     * @private
     * @param {!string} opcode
     *     The opcode of the instruction to handle.
     *
     * @param {!string[]} args
     *     The arguments of the received instruction, if any.
     */
    var loadInstruction = function loadInstruction(opcode, args) {

        // Advance end of frame by overall length of parsed instruction
        frameEnd += getElementSize(opcode);
        for (var i = 0; i < args.length; i++)
            frameEnd += getElementSize(args[i]);

        // Once a sync is received, store all instructions since the last
        // frame as a new frame
        if (opcode === 'sync') {

            // Parse frame timestamp from sync instruction
            var timestamp = parseInt(args[0]);

            // Add a new frame containing the instructions read since last frame
            var frame = new Guacamole.SessionRecording._Frame(timestamp, frameStart, frameEnd);
            frames.push(frame);
            frameStart = frameEnd;

            // If this is the first frame, intialize the key event interpreter
            // with the timestamp of the first frame
            if (frames.length === 1)
                initializeKeyInterpreter(timestamp);

            // This frame should eventually become a keyframe if enough data
            // has been processed and enough recording time has elapsed, or if
            // this is the absolute first frame
            if (frames.length === 1 || (frameEnd - frames[lastKeyframe].start >= KEYFRAME_CHAR_INTERVAL
                    && timestamp - frames[lastKeyframe].timestamp >= KEYFRAME_TIME_INTERVAL)) {
                frame.keyframe = true;
                lastKeyframe = frames.length - 1;

            }

            // Notify that additional content is available
            if (recording.onprogress)
                recording.onprogress(recording.getDuration(), frameEnd);

        }

        else if (opcode === 'key')
            keyEventInterpreter.handleKeyEvent(args);
    };

    /**
     * Notifies that the session recording has been fully loaded. If the onload
     * handler has not been defined, this function has no effect.
     *
     * @private
     */
    var notifyLoaded = function notifyLoaded() {
        if (recording.onload)
            recording.onload();
    };

    // Read instructions from provided blob, extracting each frame
    if (source instanceof Blob) {
        recordingBlob = source;
        parseBlob(recordingBlob, loadInstruction, notifyLoaded);
    }

    // If tunnel provided instead of Blob, extract frames, etc. as instructions
    // are received, buffering things into a Blob for future seeks
    else {

        tunnel = source;
        recordingBlob = new Blob();

        var errorEncountered = false;
        var instructionBuffer = '';

        // Read instructions from provided tunnel, extracting each frame
        tunnel.oninstruction = function handleInstruction(opcode, args) {

            // Reconstitute received instruction
            instructionBuffer += opcode.length + '.' + opcode;
            args.forEach(function appendArg(arg) {
                instructionBuffer += ',' + arg.length + '.' + arg;
            });
            instructionBuffer += ';';

            // Append to Blob (creating a new Blob in the process)
            if (instructionBuffer.length >= BLOCK_SIZE) {
                recordingBlob = new Blob([recordingBlob, instructionBuffer]);
                instructionBuffer = '';
            }

            // Load parsed instruction into recording
            loadInstruction(opcode, args);

        };

        // Report any errors encountered
        tunnel.onerror = function tunnelError(status) {
            errorEncountered = true;
            if (recording.onerror)
                recording.onerror(status.message);
        };

        tunnel.onstatechange = function tunnelStateChanged(state) {
            if (state === Guacamole.Tunnel.State.CLOSED) {

                // Append any remaining instructions
                if (instructionBuffer.length) {
                    recordingBlob = new Blob([recordingBlob, instructionBuffer]);
                    instructionBuffer = '';
                }

                // Now that the recording is fully processed, and all key events
                // have been extracted, call the onkeyevents handler if defined
                if (recording.onkeyevents)
                    recording.onkeyevents(keyEventInterpreter.getEvents());

                // Consider recording loaded if tunnel has closed without errors
                if (!errorEncountered)
                    notifyLoaded();
            }
        };

    }

    /**
     * Converts the given absolute timestamp to a timestamp which is relative
     * to the first frame in the recording.
     *
     * @private
     * @param {!number} timestamp
     *     The timestamp to convert to a relative timestamp.
     *
     * @returns {!number}
     *     The difference in milliseconds between the given timestamp and the
     *     first frame of the recording, or zero if no frames yet exist.
     */
    var toRelativeTimestamp = function toRelativeTimestamp(timestamp) {

        // If no frames yet exist, all timestamps are zero
        if (frames.length === 0)
            return 0;

        // Calculate timestamp relative to first frame
        return timestamp - frames[0].timestamp;

    };

    /**
     * Searches through the given region of frames for the closest frame
     * having a relative timestamp less than or equal to the to the given
     * relative timestamp.
     *
     * @private
     * @param {!number} minIndex
     *     The index of the first frame in the region (the frame having the
     *     smallest timestamp).
     *
     * @param {!number} maxIndex
     *     The index of the last frame in the region (the frame having the
     *     largest timestamp).
     *
     * @param {!number} timestamp
     *     The relative timestamp to search for, where zero denotes the first
     *     frame in the recording.
     *
     * @returns {!number}
     *     The index of the frame having a relative timestamp closest to the
     *     given value.
     */
    var findFrame = function findFrame(minIndex, maxIndex, timestamp) {

        // The region has only one frame - determine if it is before or after
        // the requested timestamp
        if (minIndex === maxIndex) {

            // Skip checking if this is the very first frame - no frame could
            // possibly be earlier
            if (minIndex === 0)
                return minIndex;

            // If the closest frame occured after the requested timestamp,
            // return the previous frame, which will be the closest with a
            // timestamp before the requested timestamp
            if (toRelativeTimestamp(frames[minIndex].timestamp) > timestamp)
                return minIndex - 1;

        }

        // Split search region into two halves
        var midIndex = Math.floor((minIndex + maxIndex) / 2);
        var midTimestamp = toRelativeTimestamp(frames[midIndex].timestamp);

        // If timestamp is within lesser half, search again within that half
        if (timestamp < midTimestamp && midIndex > minIndex)
            return findFrame(minIndex, midIndex - 1, timestamp);

        // If timestamp is within greater half, search again within that half
        if (timestamp > midTimestamp && midIndex < maxIndex)
            return findFrame(midIndex + 1, maxIndex, timestamp);

        // Otherwise, we lucked out and found a frame with exactly the
        // desired timestamp
        return midIndex;

    };

    /**
     * Replays the instructions associated with the given frame, sending those
     * instructions to the playback client.
     *
     * @private
     * @param {!number} index
     *     The index of the frame within the frames array which should be
     *     replayed.
     *
     * @param {function} callback
     *     The callback to invoke once replay of the frame has completed.
     */
    var replayFrame = function replayFrame(index, callback) {

        var frame = frames[index];

        // Replay all instructions within the retrieved frame
        parseBlob(recordingBlob.slice(frame.start, frame.end), function handleInstruction(opcode, args) {
            playbackTunnel.receiveInstruction(opcode, args);
        }, function replayCompleted() {

            // Store client state if frame is flagged as a keyframe
            if (frame.keyframe && !frame.clientState) {
                playbackClient.exportState(function storeClientState(state) {
                    frame.clientState = new Blob([JSON.stringify(state)]);
                });
            }

            // Update state to correctly represent the current frame
            currentFrame = index;

            if (callback)
                callback();

        });

    };

    /**
     * Moves the playback position to the given frame, resetting the state of
     * the playback client and replaying frames as necessary. The seek
     * operation will proceed asynchronously. If a seek operation is already in
     * progress, that seek is first aborted. The progress of the seek operation
     * can be observed through the onseek handler and the provided callback.
     *
     * @private
     * @param {!number} index
     *     The index of the frame which should become the new playback
     *     position.
     *
     * @param {function} callback
     *     The callback to invoke once the seek operation has completed.
     *
     * @param {number} [nextRealTimestamp]
     *     The timestamp of the point in time that the given frame should be
     *     displayed, as would be returned by new Date().getTime(). If omitted,
     *     the frame will be displayed as soon as possible.
     */
    var seekToFrame = function seekToFrame(index, callback, nextRealTimestamp) {

        // Abort any in-progress seek
        abortSeek();

        // Note that a new seek operation is in progress
        var thisSeek = activeSeek = {
            aborted : false
        };

        var startIndex = index;

        // Replay any applicable incremental frames
        var continueReplay = function continueReplay() {

            // Set the current position and notify changes
            if (recording.onseek && currentFrame > startIndex) {
                currentPosition = toRelativeTimestamp(frames[currentFrame].timestamp);
                recording.onseek(currentPosition, currentFrame - startIndex,
                        index - startIndex);
            }

            // Cancel seek if aborted
            if (thisSeek.aborted)
                return;

            // If frames remain, replay the next frame
            if (currentFrame < index)
                replayFrame(currentFrame + 1, continueReplay);

            // Otherwise, the seek operation is completed
            else
                callback();

        };

        // Continue replay after requested delay has elapsed, or
        // immediately if no delay was requested
        var continueAfterRequiredDelay = function continueAfterRequiredDelay() {
            var delay = nextRealTimestamp ? Math.max(nextRealTimestamp - new Date().getTime(), 0) : 0;
            if (delay) {

                // Clear any already-scheduled update before scheduling again
                // to avoid multiple updates in flight at the same time
                updateTimeout && clearTimeout(updateTimeout);

                // Schedule with the appropriate delay
                updateTimeout = window.setTimeout(function timeoutComplete() {
                    updateTimeout = null;
                    continueReplay();
                }, delay);
            }
            else
                continueReplay();
        };

        // Back up until startIndex represents current state
        for (; startIndex >= 0; startIndex--) {

            var frame = frames[startIndex];

            // If we've reached the current frame, startIndex represents
            // current state by definition
            if (startIndex === currentFrame)
                break;

            // If frame has associated absolute state, make that frame the
            // current state
            if (frame.clientState) {
                frame.clientState.text().then(function textReady(text) {
                    playbackClient.importState(JSON.parse(text));
                    currentFrame = startIndex;
                    continueAfterRequiredDelay();
                });
                return;
            }

        }

        continueAfterRequiredDelay();

    };

    /**
     * Aborts the seek operation currently in progress, if any. If no seek
     * operation is in progress, this function has no effect.
     *
     * @private
     */
    var abortSeek = function abortSeek() {
        if (activeSeek) {
            activeSeek.aborted = true;
            activeSeek = null;
        }
    };

    /**
     * Advances playback to the next frame in the frames array and schedules
     * playback of the frame following that frame based on their associated
     * timestamps. If no frames exist after the next frame, playback is paused.
     *
     * @private
     */
    var continuePlayback = function continuePlayback() {

        // Do not continue playback if the recording is paused
        if (!recording.isPlaying())
            return;

        // If frames remain after advancing, schedule next frame
        if (currentFrame + 1 < frames.length) {

            // Pull the upcoming frame
            var next = frames[currentFrame + 1];

            // The number of elapsed milliseconds on the clock since playback began
            var realLifePlayTime = Date.now() - startRealTimestamp;

            // The number of milliseconds between the recording position when
            // playback started and the position of the next frame
            var timestampOffset = (
                    toRelativeTimestamp(next.timestamp) - startVideoPosition);

            // The delay until the next frame should be rendered, taking into
            // account any accumulated delays from rendering frames so far
            var nextFrameDelay = timestampOffset - realLifePlayTime;

            // The delay until the refresh interval would induce an update to
            // the current recording position, rounded to the nearest whole
            // multiple of refreshInterval to ensure consistent timing for
            // refresh intervals even with inconsistent frame timing
            var nextRefreshDelay = refreshInterval >= 0
                    ? (refreshInterval * (Math.floor(
                        (currentPosition + refreshInterval) / refreshInterval))
                    ) - currentPosition
                    : nextFrameDelay;

            // If the next frame will occur before the next refresh interval,
            // advance to the frame after the appropriate delay
            if (nextFrameDelay <= nextRefreshDelay)

                seekToFrame(currentFrame + 1, function frameDelayElapsed() {

                    // Record when the timestamp was updated and continue on
                    lastUpdateTimestamp = Date.now();
                    continuePlayback();

                }, Date.now() + nextFrameDelay);

            // The position needs to be incremented before the next frame
            else {

                // Clear any existing update timeout
                updateTimeout && window.clearTimeout(updateTimeout);

                updateTimeout = window.setTimeout(function incrementPosition() {

                    updateTimeout = null;

                    // Update the position
                    currentPosition += nextRefreshDelay;

                    // Notifiy the new position using the onseek handler
                    if (recording.onseek)
                        recording.onseek(currentPosition);

                    // Record when the timestamp was updated and continue on
                    lastUpdateTimestamp = Date.now();
                    continuePlayback();

                }, nextRefreshDelay);
            }

        }

        // Otherwise stop playback
        else
            recording.pause();

    };

    /**
     * Fired when loading of this recording has completed and all frames
     * are available.
     *
     * @event
     */
    this.onload = null;

    /**
     * Fired when an error occurs which prevents the recording from being
     * played back.
     *
     * @event
     * @param {!string} message
     *     A human-readable message describing the error that occurred.
     */
    this.onerror = null;

    /**
     * Fired when further loading of this recording has been explicitly
     * aborted through a call to abort().
     *
     * @event
     */
    this.onabort = null;

    /**
     * Fired when new frames have become available while the recording is
     * being downloaded.
     *
     * @event
     * @param {!number} duration
     *     The new duration of the recording, in milliseconds.
     *
     * @param {!number} parsedSize
     *     The number of bytes that have been loaded/parsed.
     */
    this.onprogress = null;

    /**
     * Fired whenever playback of the recording has started.
     *
     * @event
     */
    this.onplay = null;

    /**
     * Fired whenever playback of the recording has been paused. This may
     * happen when playback is explicitly paused with a call to pause(), or
     * when playback is implicitly paused due to reaching the end of the
     * recording.
     *
     * @event
     */
    this.onpause = null;

    /**
     * Fired with all extracted key events when the recording is fully
     * processed. The callback will be invoked with an empty list
     * if no key events were extracted.
     *
     * @event
     * @param {!Guacamole.KeyEventInterpreter.KeyEvent[]} batch
     *     The extracted key events.
     */
    this.onkeyevents = null;

    /**
     * Fired whenever the playback position within the recording changes.
     *
     * @event
     * @param {!number} position
     *     The new position within the recording, in milliseconds.
     *
     * @param {!number} current
     *     The number of frames that have been seeked through. If not
     *     seeking through multiple frames due to a call to seek(), this
     *     will be 1.
     *
     * @param {!number} total
     *     The number of frames that are being seeked through in the
     *     current seek operation. If not seeking through multiple frames
     *     due to a call to seek(), this will be 1.
     */
    this.onseek = null;

    /**
     * Connects the underlying tunnel, beginning download of the Guacamole
     * session. Playback of the Guacamole session cannot occur until at least
     * one frame worth of instructions has been downloaded. If the underlying
     * recording source is a Blob, this function has no effect.
     *
     * @param {string} [data]
     *     The data to send to the tunnel when connecting.
     */
    this.connect = function connect(data) {
        if (tunnel)
            tunnel.connect(data);
    };

    /**
     * Disconnects the underlying tunnel, stopping further download of the
     * Guacamole session. If the underlying recording source is a Blob, this
     * function has no effect.
     */
    this.disconnect = function disconnect() {
        if (tunnel)
            tunnel.disconnect();
    };

    /**
     * Aborts the loading process, stopping further processing of the
     * provided data. If the underlying recording source is a Guacamole tunnel,
     * it will be disconnected.
     */
    this.abort = function abort() {
        if (!aborted) {

            aborted = true;
            if (recording.onabort)
                recording.onabort();

            if (tunnel)
                tunnel.disconnect();

        }
    };

    /**
     * Returns the underlying display of the Guacamole.Client used by this
     * Guacamole.SessionRecording for playback. The display contains an Element
     * which can be added to the DOM, causing the display (and thus playback of
     * the recording) to become visible.
     *
     * @return {!Guacamole.Display}
     *     The underlying display of the Guacamole.Client used by this
     *     Guacamole.SessionRecording for playback.
     */
    this.getDisplay = function getDisplay() {
        return playbackClient.getDisplay();
    };

    /**
     * Returns whether playback is currently in progress.
     *
     * @returns {!boolean}
     *     true if playback is currently in progress, false otherwise.
     */
    this.isPlaying = function isPlaying() {
        return !!startRealTimestamp;
    };

    /**
     * Returns the current playback position within the recording, in
     * milliseconds, where zero is the start of the recording.
     *
     * @returns {!number}
     *     The current playback position within the recording, in milliseconds.
     */
    this.getPosition = function getPosition() {

        return currentPosition;

    };

    /**
     * Returns the duration of this recording, in milliseconds. If the
     * recording is still being downloaded, this value will gradually increase.
     *
     * @returns {!number}
     *     The duration of this recording, in milliseconds.
     */
    this.getDuration = function getDuration() {

        // If no frames yet exist, duration is zero
        if (frames.length === 0)
            return 0;

        // Recording duration is simply the timestamp of the last frame
        return toRelativeTimestamp(frames[frames.length - 1].timestamp);

    };

    /**
     * Begins continuous playback of the recording downloaded thus far.
     * Playback of the recording will continue until pause() is invoked or
     * until no further frames exist. Playback is initially paused when a
     * Guacamole.SessionRecording is created, and must be explicitly started
     * through a call to this function. If playback is already in progress,
     * this function has no effect. If a seek operation is in progress,
     * playback resumes at the current position, and the seek is aborted as if
     * completed.
     */
    this.play = function play() {

        // If playback is not already in progress and frames remain,
        // begin playback
        if (!recording.isPlaying() && currentFrame + 1 < frames.length) {

            // Notify that playback is starting
            if (recording.onplay)
                recording.onplay();

            // Store timestamp of playback start for relative scheduling of
            // future frames
            startVideoPosition = currentPosition;
            startRealTimestamp = Date.now();

            // Begin playback of video
            lastUpdateTimestamp = Date.now();
            continuePlayback();

        }

    };

    /**
     * Seeks to the given position within the recording. If the recording is
     * currently being played back, playback will continue after the seek is
     * performed. If the recording is currently paused, playback will be
     * paused after the seek is performed. If a seek operation is already in
     * progress, that seek is first aborted. The seek operation will proceed
     * asynchronously.
     *
     * @param {!number} position
     *     The position within the recording to seek to, in milliseconds.
     *
     * @param {function} [callback]
     *     The callback to invoke once the seek operation has completed.
     */
    this.seek = function seek(position, callback) {

        // Do not seek if no frames exist
        if (frames.length === 0)
            return;

        // Abort active seek operation, if any
        recording.cancel();

        // Pause playback, preserving playback state
        var originallyPlaying = recording.isPlaying();
        recording.pause();

        // Restore playback when seek is completed or cancelled
        seekCallback = function restorePlaybackState() {

            // Seek is no longer in progress
            seekCallback = null;

            // Restore playback state
            if (originallyPlaying) {
                recording.play();
                originallyPlaying = null;
            }

            // Notify that seek has completed
            if (callback)
                callback();

        };

        // Find the index of the closest frame at or before the requested position
        var closestFrame = findFrame(0, frames.length - 1, position);

        // Seek to the closest frame before or at the requested position
        seekToFrame(closestFrame, function seekComplete() {

            // Update the current position to the requested position
            // and invoke the the onseek callback. Note that this is the
            // position provided to this function, NOT the position of the
            // frame that was just seeked
            currentPosition = position;
            if (recording.onseek)
                recording.onseek(position);

            seekCallback();

        });

    };

    /**
     * Cancels the current seek operation, setting the current frame of the
     * recording to wherever the seek operation was able to reach prior to
     * being cancelled. If a callback was provided to seek(), that callback
     * is invoked. If a seek operation is not currently underway, this
     * function has no effect.
     */
    this.cancel = function cancel() {
        if (seekCallback) {
            abortSeek();
            seekCallback();
        }
    };

    /**
     * Pauses playback of the recording, if playback is currently in progress.
     * If playback is not in progress, this function has no effect. If a seek
     * operation is in progress, the seek is aborted. Playback is initially
     * paused when a Guacamole.SessionRecording is created, and must be
     * explicitly started through a call to play().
     */
    this.pause = function pause() {

        // Abort any in-progress seek / playback
        abortSeek();

        // Cancel any currently-scheduled updates
        updateTimeout && clearTimeout(updateTimeout);

        // Increment the current position by the amount of time passed since the
        // the last time it was updated
        currentPosition += Date.now() - lastUpdateTimestamp;

        // Stop playback only if playback is in progress
        if (recording.isPlaying()) {

            // Notify that playback is stopping
            if (recording.onpause)
                recording.onpause();

            // Playback is stopped
            lastUpdateTimestamp = null;
            startVideoPosition = null;
            startRealTimestamp = null;

        }

    };

};

/**
 * A single frame of Guacamole session data. Each frame is made up of the set
 * of instructions used to generate that frame, and the timestamp as dictated
 * by the "sync" instruction terminating the frame. Optionally, a frame may
 * also be associated with a snapshot of Guacamole client state, such that the
 * frame can be rendered without replaying all previous frames.
 *
 * @private
 * @constructor
 * @param {!number} timestamp
 *     The timestamp of this frame, as dictated by the "sync" instruction which
 *     terminates the frame.
 *
 * @param {!number} start
 *     The byte offset within the blob of the first character of the first
 *     instruction of this frame.
 *
 * @param {!number} end
 *     The byte offset within the blob of character which follows the last
 *     character of the last instruction of this frame.
 */
Guacamole.SessionRecording._Frame = function _Frame(timestamp, start, end) {

    /**
     * Whether this frame should be used as a keyframe if possible. This value
     * is purely advisory. The stored clientState must eventually be manually
     * set for the frame to be used as a keyframe. By default, frames are not
     * keyframes.
     *
     * @type {!boolean}
     * @default false
     */
    this.keyframe = false;

    /**
     * The timestamp of this frame, as dictated by the "sync" instruction which
     * terminates the frame.
     *
     * @type {!number}
     */
    this.timestamp = timestamp;

    /**
     * The byte offset within the blob of the first character of the first
     * instruction of this frame.
     *
     * @type {!number}
     */
    this.start = start;

    /**
     * The byte offset within the blob of character which follows the last
     * character of the last instruction of this frame.
     *
     * @type {!number}
     */
    this.end = end;

    /**
     * A snapshot of client state after this frame was rendered, as returned by
     * a call to exportState(), serialized as JSON, and stored within a Blob.
     * Use of Blobs here is required to ensure the browser can make use of
     * larger disk-backed storage if the size of the recording is large. If no
     * such snapshot has been taken, this will be null.
     *
     * @type {Blob}
     * @default null
     */
    this.clientState = null;

};

/**
 * A read-only Guacamole.Tunnel implementation which streams instructions
 * received through explicit calls to its receiveInstruction() function.
 *
 * @private
 * @constructor
 * @augments {Guacamole.Tunnel}
 */
Guacamole.SessionRecording._PlaybackTunnel = function _PlaybackTunnel() {

    /**
     * Reference to this Guacamole.SessionRecording._PlaybackTunnel.
     *
     * @private
     * @type {!Guacamole.SessionRecording._PlaybackTunnel}
     */
    var tunnel = this;

    this.connect = function connect(data) {
        // Do nothing
    };

    this.sendMessage = function sendMessage(elements) {
        // Do nothing
    };

    this.disconnect = function disconnect() {
        // Do nothing
    };

    /**
     * Invokes this tunnel's oninstruction handler, notifying users of this
     * tunnel (such as a Guacamole.Client instance) that an instruction has
     * been received. If the oninstruction handler has not been set, this
     * function has no effect.
     *
     * @param {!string} opcode
     *     The opcode of the Guacamole instruction.
     *
     * @param {!string[]} args
     *     All arguments associated with this Guacamole instruction.
     */
    this.receiveInstruction = function receiveInstruction(opcode, args) {
        if (tunnel.oninstruction)
            tunnel.oninstruction(opcode, args);
    };

};
