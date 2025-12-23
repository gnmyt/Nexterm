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
 * A hidden input field which attempts to keep itself focused at all times,
 * except when another input field has been intentionally focused, whether
 * programatically or by the user. The actual underlying input field, returned
 * by getElement(), may be used as a reliable source of keyboard-related events,
 * particularly composition and input events which may require a focused input
 * field to be dispatched at all.
 *
 * @constructor
 */
Guacamole.InputSink = function InputSink() {

    /**
     * Reference to this instance of Guacamole.InputSink.
     *
     * @private
     * @type {!Guacamole.InputSink}
     */
    var sink = this;

    /**
     * The underlying input field, styled to be invisible.
     *
     * @private
     * @type {!Element}
     */
    var field = document.createElement('textarea');
    field.style.position   = 'fixed';
    field.style.outline    = 'none';
    field.style.border     = 'none';
    field.style.margin     = '0';
    field.style.padding    = '0';
    field.style.height     = '0';
    field.style.width      = '0';
    field.style.left       = '0';
    field.style.bottom     = '0';
    field.style.resize     = 'none';
    field.style.background = 'transparent';
    field.style.color      = 'transparent';

    // Keep field clear when modified via normal keypresses
    field.addEventListener("keypress", function clearKeypress(e) {
        field.value = '';
    }, false);

    // Keep field clear when modofied via composition events
    field.addEventListener("compositionend", function clearCompletedComposition(e) {
        if (e.data)
            field.value = '';
    }, false);

    // Keep field clear when modofied via input events
    field.addEventListener("input", function clearCompletedInput(e) {
        if (e.data && !e.isComposing)
            field.value = '';
    }, false);

    // Whenever focus is gained, automatically click to ensure cursor is
    // actually placed within the field (the field may simply be highlighted or
    // outlined otherwise)
    field.addEventListener("focus", function focusReceived() {
        window.setTimeout(function deferRefocus() {
            field.click();
            field.select();
        }, 0);
    }, true);

    /**
     * Attempts to focus the underlying input field. The focus attempt occurs
     * asynchronously, and may silently fail depending on browser restrictions.
     */
    this.focus = function focus() {
        window.setTimeout(function deferRefocus() {
            field.focus(); // Focus must be deferred to work reliably across browsers
        }, 0);
    };

    /**
     * Returns the underlying input field. This input field MUST be manually
     * added to the DOM for the Guacamole.InputSink to have any effect.
     *
     * @returns {!Element}
     *     The underlying input field.
     */
    this.getElement = function getElement() {
        return field;
    };

    // Automatically refocus input sink if part of DOM
    document.addEventListener("keydown", function refocusSink(e) {

        // Do not refocus if focus is on an input field
        var focused = document.activeElement;
        if (focused && focused !== document.body) {

            // Only consider focused input fields which are actually visible
            var rect = focused.getBoundingClientRect();
            if (rect.left + rect.width > 0 && rect.top + rect.height > 0)
                return;

        }

        // Refocus input sink instead of handling click
        sink.focus();

    }, true);

};
