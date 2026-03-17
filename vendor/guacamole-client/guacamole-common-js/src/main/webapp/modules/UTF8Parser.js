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
 * Parser that decodes UTF-8 text from a series of provided ArrayBuffers.
 * Multi-byte characters that continue from one buffer to the next are handled
 * correctly.
 *
 * @constructor
 */
Guacamole.UTF8Parser = function UTF8Parser() {

    /**
     * The number of bytes remaining for the current codepoint.
     *
     * @private
     * @type {!number}
     */
    var bytesRemaining = 0;

    /**
     * The current codepoint value, as calculated from bytes read so far.
     *
     * @private
     * @type {!number}
     */
    var codepoint = 0;

    /**
     * Decodes the given UTF-8 data into a Unicode string, returning a string
     * containing all complete UTF-8 characters within the provided data. The
     * data may end in the middle of a multi-byte character, in which case the
     * complete character will be returned from a later call to decode() after
     * enough bytes have been provided.
     *
     * @private
     * @param {!ArrayBuffer} buffer
     *     Arbitrary UTF-8 data.
     *
     * @return {!string}
     *     The decoded Unicode string.
     */
    this.decode = function decode(buffer) {

        var text = '';

        var bytes = new Uint8Array(buffer);
        for (var i=0; i<bytes.length; i++) {

            // Get current byte
            var value = bytes[i];

            // Start new codepoint if nothing yet read
            if (bytesRemaining === 0) {

                // 1 byte (0xxxxxxx)
                if ((value | 0x7F) === 0x7F)
                    text += String.fromCharCode(value);

                // 2 byte (110xxxxx)
                else if ((value | 0x1F) === 0xDF) {
                    codepoint = value & 0x1F;
                    bytesRemaining = 1;
                }

                // 3 byte (1110xxxx)
                else if ((value | 0x0F )=== 0xEF) {
                    codepoint = value & 0x0F;
                    bytesRemaining = 2;
                }

                // 4 byte (11110xxx)
                else if ((value | 0x07) === 0xF7) {
                    codepoint = value & 0x07;
                    bytesRemaining = 3;
                }

                // Invalid byte
                else
                    text += '\uFFFD';

            }

            // Continue existing codepoint (10xxxxxx)
            else if ((value | 0x3F) === 0xBF) {

                codepoint = (codepoint << 6) | (value & 0x3F);
                bytesRemaining--;

                // Write codepoint if finished
                if (bytesRemaining === 0)
                    text += String.fromCharCode(codepoint);

            }

            // Invalid byte
            else {
                bytesRemaining = 0;
                text += '\uFFFD';
            }

        }

        return text;

    };

};