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
 * An object that will accept raw key events and produce a chronologically
 * ordered array of key event objects. These events can be obtained by
 * calling getEvents().
 *
 * @constructor
 * @param {number} [startTimestamp=0]
 *     The starting timestamp for the recording being intepreted. If provided,
 *     the timestamp of each intepreted event will be relative to this timestamp.
 *     If not provided, the raw recording timestamp will be used.
 */
Guacamole.KeyEventInterpreter = function KeyEventInterpreter(startTimestamp) {

    // Default to 0 seconds to keep the raw timestamps
    if (startTimestamp === undefined || startTimestamp === null)
        startTimestamp = 0;

    /**
     * A precursor array to the KNOWN_KEYS map. The objects contained within
     * will be constructed into full KeyDefinition objects.
     *
     * @constant
     * @private
     * @type {Object[]}
     */
    var _KNOWN_KEYS = [
        {keysym: 0xFE03, name: 'AltGr' },
        {keysym: 0xFF08, name: 'Backspace' },
        {keysym: 0xFF09, name: 'Tab' },
        {keysym: 0xFF0B, name: 'Clear' },
        {keysym: 0xFF0D, name: 'Return', value: "\n" },
        {keysym: 0xFF13, name: 'Pause' },
        {keysym: 0xFF14, name: 'Scroll' },
        {keysym: 0xFF15, name: 'SysReq' },
        {keysym: 0xFF1B, name: 'Escape' },
        {keysym: 0xFF50, name: 'Home' },
        {keysym: 0xFF51, name: 'Left' },
        {keysym: 0xFF52, name: 'Up' },
        {keysym: 0xFF53, name: 'Right' },
        {keysym: 0xFF54, name: 'Down' },
        {keysym: 0xFF55, name: 'Page Up' },
        {keysym: 0xFF56, name: 'Page Down' },
        {keysym: 0xFF57, name: 'End' },
        {keysym: 0xFF63, name: 'Insert' },
        {keysym: 0xFF65, name: 'Undo' },
        {keysym: 0xFF6A, name: 'Help' },
        {keysym: 0xFF7F, name: 'Num' },
        {keysym: 0xFF80, name: 'Space', value: " " },
        {keysym: 0xFF8D, name: 'Enter', value: "\n" },
        {keysym: 0xFF95, name: 'Home' },
        {keysym: 0xFF96, name: 'Left' },
        {keysym: 0xFF97, name: 'Up' },
        {keysym: 0xFF98, name: 'Right' },
        {keysym: 0xFF99, name: 'Down' },
        {keysym: 0xFF9A, name: 'Page Up' },
        {keysym: 0xFF9B, name: 'Page Down' },
        {keysym: 0xFF9C, name: 'End' },
        {keysym: 0xFF9E, name: 'Insert' },
        {keysym: 0xFFAA, name: '*', value: "*" },
        {keysym: 0xFFAB, name: '+', value: "+" },
        {keysym: 0xFFAD, name: '-', value: "-" },
        {keysym: 0xFFAE, name: '.', value: "." },
        {keysym: 0xFFAF, name: '/', value: "/" },
        {keysym: 0xFFB0, name: '0', value: "0" },
        {keysym: 0xFFB1, name: '1', value: "1" },
        {keysym: 0xFFB2, name: '2', value: "2" },
        {keysym: 0xFFB3, name: '3', value: "3" },
        {keysym: 0xFFB4, name: '4', value: "4" },
        {keysym: 0xFFB5, name: '5', value: "5" },
        {keysym: 0xFFB6, name: '6', value: "6" },
        {keysym: 0xFFB7, name: '7', value: "7" },
        {keysym: 0xFFB8, name: '8', value: "8" },
        {keysym: 0xFFB9, name: '9', value: "9" },
        {keysym: 0xFFBE, name: 'F1' },
        {keysym: 0xFFBF, name: 'F2' },
        {keysym: 0xFFC0, name: 'F3' },
        {keysym: 0xFFC1, name: 'F4' },
        {keysym: 0xFFC2, name: 'F5' },
        {keysym: 0xFFC3, name: 'F6' },
        {keysym: 0xFFC4, name: 'F7' },
        {keysym: 0xFFC5, name: 'F8' },
        {keysym: 0xFFC6, name: 'F9' },
        {keysym: 0xFFC7, name: 'F10' },
        {keysym: 0xFFC8, name: 'F11' },
        {keysym: 0xFFC9, name: 'F12' },
        {keysym: 0xFFCA, name: 'F13' },
        {keysym: 0xFFCB, name: 'F14' },
        {keysym: 0xFFCC, name: 'F15' },
        {keysym: 0xFFCD, name: 'F16' },
        {keysym: 0xFFCE, name: 'F17' },
        {keysym: 0xFFCF, name: 'F18' },
        {keysym: 0xFFD0, name: 'F19' },
        {keysym: 0xFFD1, name: 'F20' },
        {keysym: 0xFFD2, name: 'F21' },
        {keysym: 0xFFD3, name: 'F22' },
        {keysym: 0xFFD4, name: 'F23' },
        {keysym: 0xFFD5, name: 'F24' },
        {keysym: 0xFFE1, name: 'Shift' },
        {keysym: 0xFFE2, name: 'Shift' },
        {keysym: 0xFFE3, name: 'Ctrl' },
        {keysym: 0xFFE4, name: 'Ctrl' },
        {keysym: 0xFFE5, name: 'Caps' },
        {keysym: 0xFFE7, name: 'Meta' },
        {keysym: 0xFFE8, name: 'Meta' },
        {keysym: 0xFFE9, name: 'Alt' },
        {keysym: 0xFFEA, name: 'Alt' },
        {keysym: 0xFFEB, name: 'Super' },
        {keysym: 0xFFEC, name: 'Super' },
        {keysym: 0xFFED, name: 'Hyper' },
        {keysym: 0xFFEE, name: 'Hyper' },
        {keysym: 0xFFFF, name: 'Delete' }
    ];

    /**
     * All known keys, as a map of X11 keysym to KeyDefinition.
     *
     * @constant
     * @private
     * @type {Object.<String, KeyDefinition>}
     */
    var KNOWN_KEYS = {};
    _KNOWN_KEYS.forEach(function createKeyDefinitionMap(keyDefinition) {

        // Construct a map of keysym to KeyDefinition object
        KNOWN_KEYS[keyDefinition.keysym] = (
                new Guacamole.KeyEventInterpreter.KeyDefinition(keyDefinition));

    });

    /**
     * All key events parsed as of the most recent handleKeyEvent() invocation.
     *
     * @private
     * @type {!Guacamole.KeyEventInterpreter.KeyEvent[]}
     */
    var parsedEvents = [];

    /**
     * If the provided keysym corresponds to a valid UTF-8 character, return
     * a KeyDefinition for that keysym. Otherwise, return null.
     *
     * @private
     * @param {Number} keysym
     *     The keysym to produce a UTF-8 KeyDefinition for, if valid.
     *
     * @returns {Guacamole.KeyEventInterpreter.KeyDefinition}
     *     A KeyDefinition for the provided keysym, if it's a valid UTF-8
     *     keysym, or null otherwise.
     */
    function getUnicodeKeyDefinition(keysym) {

        // Translate only if keysym maps to Unicode
        if (keysym < 0x00 || (keysym > 0xFF && (keysym | 0xFFFF) != 0x0100FFFF))
            return null;

        // Convert to UTF8 string
        var codepoint = keysym & 0xFFFF;
        var name = String.fromCharCode(codepoint);

        // Create and return the definition
        return new Guacamole.KeyEventInterpreter.KeyDefinition({
                keysym: keysym, name: name, value: name});

    }

    /**
     * Return a KeyDefinition corresponding to the provided keysym.
     *
     * @private
     * @param {Number} keysym
     *     The keysym to return a KeyDefinition for.
     *
     * @returns {KeyDefinition}
     *     A KeyDefinition corresponding to the provided keysym.
     */
    function getKeyDefinitionByKeysym(keysym) {

        // If it's a known type, return the existing definition
        if (keysym in KNOWN_KEYS)
            return KNOWN_KEYS[keysym];

        // Return a UTF-8 KeyDefinition, if valid
        var definition = getUnicodeKeyDefinition(keysym);
        if (definition != null)
            return definition;

        // If it's not UTF-8, return an unknown definition, with the name
        // just set to the hex value of the keysym
        return new Guacamole.KeyEventInterpreter.KeyDefinition({
            keysym: keysym,
            name: '0x' + String(keysym.toString(16))
        })

    }

    /**
     * Handles a raw key event, appending a new key event object for every
     * handled raw event.
     *
     * @param {!string[]} args
     *     The arguments of the key event.
     */
    this.handleKeyEvent = function handleKeyEvent(args) {

        // The X11 keysym
        var keysym = parseInt(args[0]);

        // Either 1 or 0 for pressed or released, respectively
        var pressed = parseInt(args[1]);

        // The timestamp when this key event occured
        var timestamp = parseInt(args[2]);

        // The timestamp relative to the provided initial timestamp
        var relativeTimestap = timestamp - startTimestamp;

        // Known information about the parsed key
        var definition = getKeyDefinitionByKeysym(keysym);

        // Push the latest parsed event into the list
        parsedEvents.push(new Guacamole.KeyEventInterpreter.KeyEvent({
            definition: definition,
            pressed: pressed,
            timestamp: relativeTimestap
        }));

    };

    /**
     * Return the current batch of typed text. Note that the batch may be
     * incomplete, as more key events might be processed before the next
     * batch starts.
     *
     * @returns {Guacamole.KeyEventInterpreter.KeyEvent[]}
     *     The current batch of text.
     */
    this.getEvents = function getEvents() {
        return parsedEvents;
    };

};

/**
 * A definition for a known key.
 *
 * @constructor
 * @param {Guacamole.KeyEventInterpreter.KeyDefinition|object} [template={}]
 *     The object whose properties should be copied within the new
 *     KeyDefinition.
 */
Guacamole.KeyEventInterpreter.KeyDefinition = function KeyDefinition(template) {

    // Use empty object by default
    template = template || {};

    /**
     * The X11 keysym of the key.
     * @type {!number}
     */
    this.keysym = parseInt(template.keysym);

    /**
     * A human-readable name for the key.
     * @type {!String}
     */
    this.name = template.name;

    /**
     * The value which would be typed in a typical text editor, if any. If the
     * key is not associated with any typeable value, this will be undefined.
     * @type {String}
     */
    this.value = template.value;

};

/**
 * A granular description of an extracted key event, including a human-readable
 * text representation of the event, whether the event is directly typed or not,
 * and the timestamp when the event occured.
 *
 * @constructor
 * @param {Guacamole.KeyEventInterpreter.KeyEvent|object} [template={}]
 *     The object whose properties should be copied within the new
 *     KeyEvent.
 */
Guacamole.KeyEventInterpreter.KeyEvent = function KeyEvent(template) {

    // Use empty object by default
    template = template || {};

    /**
     * The key definition for the pressed key.
     *
     * @type {!Guacamole.KeyEventInterpreter.KeyDefinition}
     */
    this.definition = template.definition;

    /**
     * True if the key was pressed to create this event, or false if it was
     * released.
     *
     * @type {!boolean}
     */
    this.pressed = !!template.pressed;

    /**
     * The timestamp from the recording when this event occured.
     *
     * @type {!Number}
     */
    this.timestamp = template.timestamp;

};
