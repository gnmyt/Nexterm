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
 * strictly text data. Note that this object will overwrite any installed event
 * handlers on the given Guacamole.InputStream.
 * 
 * @constructor
 * @param {!Guacamole.InputStream} stream
 *     The stream that data will be read from.
 */
Guacamole.StringReader = function(stream) {

    /**
     * Reference to this Guacamole.InputStream.
     *
     * @private
     * @type {!Guacamole.StringReader}
     */
    var guac_reader = this;

    /**
     * Parser for received UTF-8 data.
     *
     * @type {!Guacamole.UTF8Parser}
     */
    var utf8Parser = new Guacamole.UTF8Parser();

    /**
     * Wrapped Guacamole.ArrayBufferReader.
     *
     * @private
     * @type {!Guacamole.ArrayBufferReader}
     */
    var array_reader = new Guacamole.ArrayBufferReader(stream);

    // Receive blobs as strings
    array_reader.ondata = function(buffer) {

        // Decode UTF-8
        var text = utf8Parser.decode(buffer);

        // Call handler, if present
        if (guac_reader.ontext)
            guac_reader.ontext(text);

    };

    // Simply call onend when end received
    array_reader.onend = function() {
        if (guac_reader.onend)
            guac_reader.onend();
    };

    /**
     * Fired once for every blob of text data received.
     * 
     * @event
     * @param {!string} text
     *     The data packet received.
     */
    this.ontext = null;

    /**
     * Fired once this stream is finished and no further data will be written.
     * @event
     */
    this.onend = null;

};