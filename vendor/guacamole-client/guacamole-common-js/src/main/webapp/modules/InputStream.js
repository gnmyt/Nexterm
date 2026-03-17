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
 * An input stream abstraction used by the Guacamole client to facilitate
 * transfer of files or other binary data.
 * 
 * @constructor
 * @param {!Guacamole.Client} client
 *     The client owning this stream.
 *
 * @param {!number} index
 *     The index of this stream.
 */
Guacamole.InputStream = function(client, index) {

    /**
     * Reference to this stream.
     *
     * @private
     * @type {!Guacamole.InputStream}
     */
    var guac_stream = this;

    /**
     * The index of this stream.
     *
     * @type {!number}
     */
    this.index = index;

    /**
     * Called when a blob of data is received.
     * 
     * @event
     * @param {!string} data
     *     The received base64 data.
     */
    this.onblob = null;

    /**
     * Called when this stream is closed.
     * 
     * @event
     */
    this.onend = null;

    /**
     * Acknowledges the receipt of a blob.
     * 
     * @param {!string} message
     *     A human-readable message describing the error or status.
     *
     * @param {!number} code
     *     The error code, if any, or 0 for success.
     */
    this.sendAck = function(message, code) {
        client.sendAck(guac_stream.index, message, code);
    };

    /**
     * Creates a new ReadableStream that receives the data sent to this stream
     * by the Guacamole server. This function may be invoked at most once per
     * stream, and invoking this function will overwrite any installed event
     * handlers on this stream.
     * 
     * A ReadableStream is a JavaScript object defined by the "Streams"
     * standard. It is supported by most browsers, but not necessarily all
     * browsers. The caller should verify this support is present before
     * invoking this function. The behavior of this function when the browser
     * does not support ReadableStream is not defined.
     *
     * @see {@link https://streams.spec.whatwg.org/#rs-class}
     *
     * @returns {!ReadableStream}
     *     A new ReadableStream that receives the bytes sent along this stream
     *     by the Guacamole server.
     */
    this.toReadableStream = function toReadableStream() {
        return new ReadableStream({
            type: 'bytes',
            start: function startStream(controller) {

                var reader = new Guacamole.ArrayBufferReader(guac_stream);

                // Provide any received blocks of data to the ReadableStream
                // controller, such that they will be read by whatever is
                // consuming the ReadableStream
                reader.ondata = function dataReceived(data) {

                    if (controller.byobRequest) {

                        var view = controller.byobRequest.view;
                        var length = Math.min(view.byteLength, data.byteLength);
                        var byobBlock = new Uint8Array(data, 0, length);

                        view.buffer.set(byobBlock);
                        controller.byobRequest.respond(length);

                        if (length < data.byteLength) {
                            controller.enqueue(data.slice(length));
                        }

                    }

                    else {
                        controller.enqueue(new Uint8Array(data));
                    }

                };

                // Notify the ReadableStream when the end of the stream is
                // reached
                reader.onend = function dataComplete() {
                    controller.close();
                };

            }
        });

    };

};
