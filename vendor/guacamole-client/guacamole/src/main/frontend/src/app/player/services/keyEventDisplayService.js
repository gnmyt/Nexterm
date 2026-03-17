/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

 /*
  * NOTE: This session recording player implementation is based on the Session
  * Recording Player for Glyptodon Enterprise which is available at
  * https://github.com/glyptodon/glyptodon-enterprise-player under the
  * following license:
  *
  * Copyright (C) 2019 Glyptodon, Inc.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  * THE SOFTWARE.
  */

/* global _ */

/**
 * A service for translating parsed key events in the format produced by
 * KeyEventInterpreter into display-optimized text batches.
 */
angular.module('player').factory('keyEventDisplayService',
        ['$injector', function keyEventDisplayService($injector) {

    /**
     * A set of all keysyms corresponding to modifier keys.
     * @type{Object.<Number, Boolean>}
     */
    const MODIFIER_KEYS = {
        0xFE03: true, // AltGr
        0xFFE1: true, // Left Shift
        0xFFE2: true, // Right Shift
        0xFFE3: true, // Left Control
        0xFFE4: true, // Right Control,
        0xFFE7: true, // Left Meta
        0xFFE8: true, // Right Meta
        0xFFE9: true, // Left Alt
        0xFFEA: true, // Right Alt
        0xFFEB: true, // Left Super
        0xFFEC: true, // Right Super
        0xFFED: true, // Left Hyper
        0xFFEE: true  // Right Super
    };

    /**
     * A set of all keysyms for which the name should be printed alongside the
     * value of the key itself.
     * @type{Object.<Number, Boolean>}
     */
    const PRINT_NAME_TOO_KEYS = {
        0xFF09: true, // Tab
        0xFF0D: true, // Return
        0xFF8D: true, // Enter
    };

    /**
     * A set of all keysyms corresponding to keys commonly used in shortcuts.
     * @type{Object.<Number, Boolean>}
     */
    const SHORTCUT_KEYS = {
        0xFFE3: true, // Left Control
        0xFFE4: true, // Right Control,
        0xFFE7: true, // Left Meta
        0xFFE8: true, // Right Meta
        0xFFE9: true, // Left Alt
        0xFFEA: true, // Right Alt
        0xFFEB: true, // Left Super
        0xFFEC: true, // Right Super
        0xFFED: true, // Left Hyper
        0xFFEE: true  // Right Super
    }

    /**
     * Format and return a key name for display.
     *
     * @param {*} name
     *     The name of the key
     *
     * @returns
     *     The formatted key name.
     */
    const formatKeyName = name => ('<' + name + '>');

    const service = {};

    /**
     * A batch of text associated with a recording. The batch consists of a
     * string representation of the text that would be typed based on the key
     * events in the recording, as well as a timestamp when the batch started.
     *
     * @constructor
     * @param {TextBatch|Object} [template={}]
     *     The object whose properties should be copied within the new TextBatch.
     */
    service.TextBatch = function TextBatch(template) {

        // Use empty object by default
        template = template || {};

        /**
         * All key events for this batch, some of which may be conslidated,
         * representing multiple raw events.
         *
         * @type {ConsolidatedKeyEvent[]}
         */
        this.events = template.events || [];

        /**
         * The simplified, human-readable value representing the key events for
         * this batch, equivalent to concatenating the `text` field of all key
         * events in the batch.
         *
         * @type {!String}
         */
        this.simpleValue = template.simpleValue || '';

    };

    /**
     * A granular description of an extracted key event or sequence of events.
     * It may contain multiple contiguous events of the same type, meaning that all
     * event(s) that were combined into this event must have had the same `typed`
     * field value. A single timestamp for the first combined event will be used
     * for the whole batch if consolidated.
     *
     * @constructor
     * @param {ConsolidatedKeyEvent|Object} [template={}]
     *     The object whose properties should be copied within the new KeyEventBatch.
     */
    service.ConsolidatedKeyEvent = function ConsolidatedKeyEvent(template) {

        // Use empty object by default
        template = template || {};

        /**
         * A human-readable representation of the event(s). If a series of printable
         * characters was directly typed, this will just be those character(s).
         * Otherwise it will be a string describing the event(s).
         *
         * @type {!String}
         */
        this.text = template.text;

        /**
         * True if this text of this event is exactly a typed character, or false
         * otherwise.
         *
         * @type {!boolean}
         */
        this.typed = template.typed;

        /**
         * The timestamp from the recording when this event occured.
         *
         * @type {!Number}
         */
        this.timestamp = template.timestamp;

    };

    /**
     * Accepts key events in the format produced by KeyEventInterpreter and returns
     * human readable text batches, seperated by at least `batchSeperation` milliseconds
     * if provided.
     *
     * NOTE: The event processing logic and output format is based on the `guaclog`
     * tool, with the addition of batching support.
     *
     * @param {Guacamole.KeyEventInterpreter.KeyEvent[]} [rawEvents]
     *     The raw key events to prepare for display.
     *
     * @param {number} [batchSeperation=5000]
     *     The minimum number of milliseconds that must elapse between subsequent
     *     batches of key-event-generated text. If 0 or negative, no splitting will
     *     occur, resulting in a single batch for all provided key events.
     *
     * @param {boolean} [consolidateEvents=false]
     *     Whether consecutive sequences of events with similar properties
     *     should be consolidated into a single ConsolidatedKeyEvent object for
     *     display performance reasons.
     */
    service.parseEvents = function parseEvents(
            rawEvents, batchSeperation, consolidateEvents) {

        // Default to 5 seconds if the batch seperation was not provided
        if (batchSeperation === undefined || batchSeperation === null)
            batchSeperation = 5000;
        /**
         * A map of X11 keysyms to a KeyDefinition object, if the corresponding
         * key is currently pressed. If a keysym has no entry in this map at all
         * it means that the key is not being pressed. Note that not all keysyms
         * are necessarily tracked within this map - only those that are
         * explicitly tracked.
         */
        const pressedKeys = {};

        // The timestamp of the most recent key event processed
        let lastKeyEvent = 0;

        // All text batches produced from the provided raw key events
        const batches = [new service.TextBatch()];

        // Process every provided raw
        _.forEach(rawEvents, event => {

            // Extract all fields from the raw event
            const { definition, pressed, timestamp } = event;
            const { keysym, name, value } = definition;

            // Only switch to a new batch of text if sufficient time has passed
            // since the last key event
            const newBatch = (batchSeperation >= 0
                && (timestamp - lastKeyEvent) >= batchSeperation);
            lastKeyEvent = timestamp;

            if (newBatch)
                batches.push(new service.TextBatch());

            const currentBatch = _.last(batches);

            /**
             * Either push the a new event constructed using the provided fields
             * into the latest batch, or consolidate into the latest event as
             * appropriate given the consolidation configuration and event type.
             *
             * @param {!String} text
             *     The text representation of the event.
             *
             * @param {!Boolean} typed
             *     Whether the text value would be literally produced by typing
             *     the key that produced the event.
             */
            const pushEvent = (text, typed) => {
                const latestEvent = _.last(currentBatch.events);

                // Only consolidate the event if configured to do so and it
                // matches the type of the previous event
                if (consolidateEvents && latestEvent && latestEvent.typed === typed) {
                    latestEvent.text += text;
                    currentBatch.simpleValue += text;
                }

                // Otherwise, push a new event
                else {
                    currentBatch.events.push(new service.ConsolidatedKeyEvent({
                        text, typed, timestamp}));
                    currentBatch.simpleValue += text;
                }
            }

            // Track modifier state
            if (MODIFIER_KEYS[keysym]) {
                if (pressed)
                    pressedKeys[keysym] = definition;
                else
                    delete pressedKeys[keysym];
            }

            // Append to the current typed value when a printable
            // (non-modifier) key is pressed
            else if (pressed) {

                // If any shorcut keys are currently pressed
                if (_.some(pressedKeys, (def, key) => SHORTCUT_KEYS[key])) {

                    var shortcutText = '<';

                    var firstKey = true;

                    // Compose entry by inspecting the state of each tracked key.
                    // At least one key must be pressed when in a shortcut.
                    for (let pressedKeysym in pressedKeys) {

                        var pressedKeyDefinition = pressedKeys[pressedKeysym];

                        // Print name of key
                        if (firstKey) {
                            shortcutText += pressedKeyDefinition.name;
                            firstKey = false;
                        }

                        else
                            shortcutText += ('+' + pressedKeyDefinition.name);

                    }

                    // Finally, append the printable key to close the shortcut
                    shortcutText += ('+' + name + '>')

                    // Add the shortcut to the current batch
                    pushEvent(shortcutText, false);
                }
            }

            // Print the key itself
            else {

                var keyText;
                var typed;

                // Print the value if explicitly defined
                if (value !== undefined) {

                    keyText = value;
                    typed = true;

                    // If the name should be printed in addition, add it as a
                    // seperate event before the actual character value
                    if (PRINT_NAME_TOO_KEYS[keysym])
                        pushEvent(formatKeyName(name), false);

                }

                // Otherwise print the name
                else {

                    keyText = formatKeyName(name);

                    // While this is a representation for a single character,
                    // the key text is the name of the key, not the actual
                    // character itself
                    typed = false;

                }

                // Add the key to the current batch
                pushEvent(keyText, typed);

            }

        });

        // All processed batches
        return batches;

    };

    return service;

}]);
