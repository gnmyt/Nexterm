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
 * A reader which automatically handles the given input stream, returning
 * strictly received packets as array buffers. Note that this object will
 * overwrite any installed event handlers on the given Guacamole.InputStream.
 * 
 * @constructor
 * @param {!Guacamole.InputStream} stream
 *     The stream that data will be read from.
 */
Guacamole.ArrayBufferReader = function(stream) {

    /**
     * Reference to this Guacamole.InputStream.
     * @private
     */
    var guac_reader = this;

    // Receive blobs as array buffers
    stream.onblob = function(data) {

        console.log('[ArrayBufferReader] onblob called, base64 length:', data?.length);

        var arrayBuffer, bufferView;

        // Use native methods for directly decoding base64 to an array buffer
        // when possible
        if (Uint8Array.fromBase64) {
            bufferView = Uint8Array.fromBase64(data);
            arrayBuffer = bufferView.buffer;
        }

        // Rely on binary strings and manual conversions where native methods
        // like fromBase64() are not available
        else {

            var binary = window.atob(data);
            arrayBuffer = new ArrayBuffer(binary.length);
            bufferView = new Uint8Array(arrayBuffer);

            for (var i=0; i<binary.length; i++)
                bufferView[i] = binary.charCodeAt(i);

        }

        console.log('[ArrayBufferReader] Decoded to ArrayBuffer, bytes:', arrayBuffer?.byteLength, 'has ondata:', !!guac_reader.ondata);

        // Call handler, if present
        if (guac_reader.ondata)
            guac_reader.ondata(arrayBuffer);

    };

    // Simply call onend when end received
    stream.onend = function() {
        if (guac_reader.onend)
            guac_reader.onend();
    };

    /**
     * Fired once for every blob of data received.
     * 
     * @event
     * @param {!ArrayBuffer} buffer
     *     The data packet received.
     */
    this.ondata = null;

    /**
     * Fired once this stream is finished and no further data will be written.
     * @event
     */
    this.onend = null;

};