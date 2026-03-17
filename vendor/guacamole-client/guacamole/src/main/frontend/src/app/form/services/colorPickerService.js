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

import '@simonwep/pickr/dist/themes/monolith.min.css'

/**
 * A service for prompting the user to choose a color using the "Pickr" color
 * picker. As the Pickr color picker might not be available if the JavaScript
 * features it requires are not supported by the browser (Internet Explorer),
 * the isAvailable() function should be used to test for usability.
 */
angular.module('form').provider('colorPickerService', function colorPickerServiceProvider() {

    /**
     * A singleton instance of the "Pickr" color picker, shared by all users of
     * this service. Pickr does not initialize synchronously, nor is it
     * supported by all browsers. If Pickr is not yet initialized, or is
     * unsupported, this will be null.
     *
     * @type {Pickr}
     */
    var pickr = null;

    /**
     * Whether Pickr has completed initialization.
     *
     * @type {Boolean}
     */
    var pickrInitComplete = false;

    /**
     * The HTML element to provide to Pickr as the root element.
     *
     * @type {HTMLDivElement}
     */
    var pickerContainer = document.createElement('div');
    pickerContainer.className = 'shared-color-picker';

    /**
     * An instance of Deferred which represents an active request for the
     * user to choose a color. The promise associated with the Deferred will
     * be resolved with the chosen color once a color is chosen, and rejected
     * if the request is cancelled or Pickr is not available. If no request is
     * active, this will be null.
     *
     * @type {Deferred}
     */
    var activeRequest = null;

    /**
     * Resolves the current active request with the given color value. If no
     * color value is provided, the active request is rejected. If no request
     * is active, this function has no effect.
     *
     * @param {String} [color]
     *     The color value to resolve the active request with.
     */
    var completeActiveRequest = function completeActiveRequest(color) {
        if (activeRequest) {

            // Hide color picker, if shown
            pickr.hide();

            // Resolve/reject active request depending on value provided
            if (color)
                activeRequest.resolve(color);
            else
                activeRequest.reject();

            // No active request
            activeRequest = null;

        }
    };

    try {
        pickr = Pickr.create({

            // Bind color picker to the container element
            el : pickerContainer,

            // Wrap color picker dialog in Guacamole-specific class for
            // sake of additional styling
            appClass : 'guac-input-color-picker',

            'default' : '#000000',

            // Display color details as hex
            defaultRepresentation : 'HEX',

            // Use "monolith" theme, as a nice balance between "nano" (does
            // not work in Internet Explorer) and "classic" (too big)
            theme : 'monolith',

            // Leverage the container element as the button which shows the
            // picker, relying on our own styling for that button
            useAsButton  : true,
            appendToBody : true,

            // Do not include opacity controls
            lockOpacity : true,

            // Include a selection of palette entries for convenience and
            // reference
            swatches : [],

            components: {

                // Include hue and color preview controls
                preview : true,
                hue     : true,

                // Display only a text color input field and the save and
                // cancel buttons (no clear button)
                interaction: {
                    input  : true,
                    save   : true,
                    cancel : true
                }

            }

        });

        // Hide color picker after user clicks "cancel"
        pickr.on('cancel', function colorChangeCanceled() {
            completeActiveRequest();
        });

        // Keep model in sync with changes to the color picker
        pickr.on('save', function colorChanged(color) {
            completeActiveRequest(color.toHEXA().toString());
            activeRequest = null;
        });

        // Keep color picker in sync with changes to the model
        pickr.on('init', function pickrReady() {
            pickrInitComplete = true;
        });
    }
    catch (e) {
        // If the "Pickr" color picker cannot be loaded (Internet Explorer),
        // the available flag will remain set to false
    }

    // Factory method required by provider
    this.$get = ['$injector', function colorPickerServiceFactory($injector) {

        // Required services
        var $q         = $injector.get('$q');
        var $translate = $injector.get('$translate');

        var service = {};

        /**
         * Promise which is resolved when Pickr initialization has completed
         * and rejected if Pickr cannot be used.
         *
         * @type {Promise}
         */
        var pickrPromise = (function getPickr() {

            var deferred = $q.defer();

            // Resolve promise when Pickr has completed initialization
            if (pickrInitComplete)
                deferred.resolve();
            else if (pickr)
                pickr.on('init', deferred.resolve);

            // Reject promise if Pickr cannot be used at all
            else
                deferred.reject();

            return deferred.promise;

        })();

        /**
         * Returns whether the underlying color picker (Pickr) can be used by
         * calling selectColor(). If the browser cannot support the color
         * picker, false is returned.
         *
         * @returns {Boolean}
         *     true if the underlying color picker can be used by calling
         *     selectColor(), false otherwise.
         */
        service.isAvailable = function isAvailable() {
            return pickrInitComplete;
        };

        /**
         * Prompts the user to choose a color, returning the color chosen via a
         * Promise.
         *
         * @param {Element} element
         *     The element that the user interacted with to indicate their
         *     desire to choose a color.
         *
         * @param {String} current
         *     The color that should be selected by default, in standard
         *     6-digit hexadecimal RGB format, including "#" prefix.
         *
         * @param {String[]} [palette]
         *     An array of color choices which should be exposed to the user
         *     within the color chooser for convenience. Each color must be in
         *     standard 6-digit hexadecimal RGB format, including "#" prefix.
         *
         * @returns {Promise.<String>}
         *     A Promise which is resolved with the color chosen by the user,
         *     in standard 6-digit hexadecimal RGB format with "#" prefix, and
         *     rejected if the selection operation was cancelled or the color
         *     picker cannot be used.
         */
        service.selectColor = function selectColor(element, current, palette) {

            // Show picker once the relevant translation strings have been
            // retrieved and Pickr is ready for use
            return $q.all({
                'saveString'   : $translate('APP.ACTION_SAVE'),
                'cancelString' : $translate('APP.ACTION_CANCEL'),
                'pickr'        : pickrPromise
            }).then(function dependenciesReady(deps) {

                // Cancel any active request
                completeActiveRequest();

                // Reset state of color picker to provided parameters
                pickr.setColor(current);
                element.appendChild(pickerContainer);

                // Assign translated strings to button text
                var pickrRoot = pickr.getRoot();
                pickrRoot.interaction.save.value = deps.saveString;
                pickrRoot.interaction.cancel.value = deps.cancelString;

                // Replace all color swatches with the palette of colors given
                while (pickr.removeSwatch(0)) {}
                angular.forEach(palette, pickr.addSwatch.bind(pickr));

                // Show color picker and wait for user to complete selection
                activeRequest = $q.defer();
                pickr.show();
                return activeRequest.promise;

            });

        };

        return service;

    }];

});