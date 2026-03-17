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
 * Simple Guacamole protocol parser that invokes an oninstruction event when
 * full instructions are available from data received via receive().
 *
 * @constructor
 */
Guacamole.Parser = function Parser() {

    /**
     * Reference to this parser.
     *
     * @private
     * @type {!Guacamole.Parser}
     */
    var parser = this;

    /**
     * Current buffer of received data. This buffer grows until a full
     * element is available. After a full element is available, that element
     * is flushed into the element buffer.
     *
     * @private
     * @type {!string}
     */
    var buffer = '';

    /**
     * Buffer of all received, complete elements. After an entire instruction
     * is read, this buffer is flushed, and a new instruction begins.
     *
     * @private
     * @type {!string[]}
     */
    var elementBuffer = [];

    /**
     * The character offset within the buffer of the current or most recently
     * parsed element's terminator. If sufficient characters have not yet been
     * read via calls to receive(), this may point to an offset well beyond the
     * end of the buffer. If no characters for an element have yet been read,
     * this will be -1.
     *
     * @private
     * @type {!number}
     */
    var elementEnd = -1;

    /**
     * The character offset within the buffer of the location that the parser
     * should start looking for the next element length search or next element
     * value.
     *
     * @private
     * @type {!number}
     */
    var startIndex = 0;

    /**
     * The declared length of the current element being parsed, in Unicode
     * codepoints.
     *
     * @private
     * @type {!number}
     */
    var elementCodepoints = 0;

    /**
     * The number of parsed characters that must accumulate in the begining of
     * the parse buffer before processing time is expended to truncate that
     * buffer and conserve memory.
     *
     * @private
     * @constant
     * @type {!number}
     */
    var BUFFER_TRUNCATION_THRESHOLD = 4096;

    /**
     * The lowest Unicode codepoint to require a surrogate pair when encoded
     * with UTF-16. In UTF-16, characters with codepoints at or above this
     * value are represented with a surrogate pair, while characters with
     * codepoints below this value are represented with a single character.
     *
     * @private
     * @constant
     * @type {!number}
     */
    var MIN_CODEPOINT_REQUIRES_SURROGATE = 0x10000;

    /**
     * Appends the given instruction data packet to the internal buffer of
     * this Guacamole.Parser, executing all completed instructions at
     * the beginning of this buffer, if any.
     *
     * @param {!string} packet
     *     The instruction data to receive.
     *
     * @param {!boolean} [isBuffer=false]
     *     Whether the provided data should be treated as an instruction buffer
     *     that grows continuously. If true, the data provided to receive()
     *     MUST always start with the data provided to the previous call. If
     *     false (the default), only the new data should be provided to
     *     receive(), and previously-received data will automatically be
     *     buffered by the parser as needed.
     */
    this.receive = function receive(packet, isBuffer) {

        if (isBuffer)
            buffer = packet;

        else {

            // Truncate buffer as necessary
            if (startIndex > BUFFER_TRUNCATION_THRESHOLD && elementEnd >= startIndex) {

                buffer = buffer.substring(startIndex);

                // Reset parse relative to truncation
                elementEnd -= startIndex;
                startIndex = 0;

            }

            // Append data to buffer ONLY if there is outstanding data present. It
            // is otherwise much faster to simply parse the received buffer as-is,
            // and tunnel implementations can take advantage of this by preferring
            // to send only complete instructions. Both the HTTP and WebSocket
            // tunnel implementations included with Guacamole already do this.
            if (buffer.length)
                buffer += packet;
            else
                buffer = packet;

        }

        // While search is within currently received data
        while (elementEnd < buffer.length) {

            // If we are waiting for element data
            if (elementEnd >= startIndex) {

                // If we have enough data in the buffer to fill the element
                // value, but the number of codepoints in the expected substring
                // containing the element value value is less that its declared
                // length, that can only be because the element contains
                // characters split between high and low surrogates, and the
                // actual end of the element value is further out. The minimum
                // number of additional characters that must be read to satisfy
                // the declared length is simply the difference between the
                // number of codepoints actually present vs. the expected
                // length.
                var codepoints = Guacamole.Parser.codePointCount(buffer, startIndex, elementEnd);
                if (codepoints < elementCodepoints) {
                    elementEnd += elementCodepoints - codepoints;
                    continue;
                }

                // If the current element ends with a character involving both
                // a high and low surrogate, elementEnd points to the low
                // surrogate and NOT the element terminator. We must shift the
                // end and reevaluate.
                else if (elementCodepoints && buffer.codePointAt(elementEnd - 1) >= MIN_CODEPOINT_REQUIRES_SURROGATE) {
                    elementEnd++;
                    continue;
                }

                // We now have enough data for the element. Parse.
                var element = buffer.substring(startIndex, elementEnd);
                var terminator = buffer.substring(elementEnd, elementEnd + 1);

                // Add element to array
                elementBuffer.push(element);

                // If last element, handle instruction
                if (terminator === ';') {

                    // Get opcode
                    var opcode = elementBuffer.shift();

                    // Call instruction handler.
                    if (parser.oninstruction !== null)
                        parser.oninstruction(opcode, elementBuffer);

                    // Clear elements
                    elementBuffer = [];

                    // Immediately truncate buffer if its contents have been
                    // completely parsed, so that the next call to receive()
                    // need not append to the buffer unnecessarily
                    if (!isBuffer && elementEnd + 1 === buffer.length) {
                        elementEnd = -1;
                        buffer = '';
                    }

                }
                else if (terminator !== ',')
                    throw new Error('Element terminator of instruction was not ";" nor ",".');

                // Start searching for length at character after
                // element terminator
                startIndex = elementEnd + 1;

            }

            // Search for end of length
            var lengthEnd = buffer.indexOf('.', startIndex);
            if (lengthEnd !== -1) {

                // Parse length
                elementCodepoints = parseInt(buffer.substring(elementEnd + 1, lengthEnd));
                if (isNaN(elementCodepoints))
                    throw new Error('Non-numeric character in element length.');

                // Calculate start of element
                startIndex = lengthEnd + 1;

                // Calculate location of element terminator
                elementEnd = startIndex + elementCodepoints;

            }

            // If no period yet, continue search when more data
            // is received
            else {
                startIndex = buffer.length;
                break;
            }

        } // end parse loop

    };

    /**
     * Fired once for every complete Guacamole instruction received, in order.
     *
     * @event
     * @param {!string} opcode
     *     The Guacamole instruction opcode.
     *
     * @param {!string[]} parameters
     *     The parameters provided for the instruction, if any.
     */
    this.oninstruction = null;

};

/**
 * Returns the number of Unicode codepoints (not code units) within the given
 * string. If character offsets are provided, only codepoints between those
 * offsets are counted. Unlike the length property of a string, this function
 * counts proper surrogate pairs as a single codepoint. High and low surrogate
 * characters that are not part of a proper surrogate pair are counted
 * separately as individual codepoints.
 *
 * @param {!string} str
 *     The string whose contents should be inspected.
 *
 * @param {number} [start=0]
 *     The index of the location in the given string where codepoint counting
 *     should start. If omitted, counting will begin at the start of the
 *     string.
 *
 * @param {number} [end]
 *     The index of the first location in the given string after where counting
 *     should stop (the character after the last character being counted). If
 *     omitted, all characters after the start location will be counted.
 *
 * @returns {!number}
 *     The number of Unicode codepoints within the requested portion of the
 *     given string.
 */
Guacamole.Parser.codePointCount = function codePointCount(str, start, end) {

    // Count only characters within the specified region
    str = str.substring(start || 0, end);

    // Locate each proper Unicode surrogate pair (one high surrogate followed
    // by one low surrogate)
    var surrogatePairs = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);

    // Each surrogate pair represents a single codepoint but is represented by
    // two characters in a JavaScript string, and thus is counted twice toward
    // string length. Subtracting the number of surrogate pairs adjusts that
    // length value such that it gives us the number of codepoints.
    return str.length - (surrogatePairs ? surrogatePairs.length : 0);

};

/**
 * Converts each of the values within the given array to strings, formatting
 * those strings as length-prefixed elements of a complete Guacamole
 * instruction.
 *
 * @param {!Array.<*>} elements
 *     The values that should be encoded as the elements of a Guacamole
 *     instruction. Order of these elements is preserved. This array MUST have
 *     at least one element.
 *
 * @returns {!string}
 *     A complete Guacamole instruction consisting of each of the provided
 *     element values, in order.
 */
Guacamole.Parser.toInstruction = function toInstruction(elements) {

    /**
     * Converts the given value to a length/string pair for use as an
     * element in a Guacamole instruction.
     *
     * @private
     * @param {*} value
     *     The value to convert.
     *
     * @return {!string}
     *     The converted value.
     */
    var toElement = function toElement(value) {
        var str = '' + value;
        return Guacamole.Parser.codePointCount(str) + "." + str;
    };

    var instr = toElement(elements[0]);
    for (var i = 1; i < elements.length; i++)
        instr += ',' + toElement(elements[i]);

    return instr + ';';

};
