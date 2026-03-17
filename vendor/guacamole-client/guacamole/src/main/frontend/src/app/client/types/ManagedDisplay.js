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

/**
 * Provides the ManagedDisplay class used by the guacClientManager service.
 */
angular.module('client').factory('ManagedDisplay', ['$rootScope',
    function defineManagedDisplay($rootScope) {

    /**
     * Object which serves as a surrogate interface, encapsulating a Guacamole
     * display while it is active, allowing it to be detached and reattached
     * from different client views.
     * 
     * @constructor
     * @param {ManagedDisplay|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedDisplay.
     */
    var ManagedDisplay = function ManagedDisplay(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The underlying Guacamole display.
         * 
         * @type Guacamole.Display
         */
        this.display = template.display;

        /**
         * The current size of the Guacamole display.
         *
         * @type ManagedDisplay.Dimensions
         */
        this.size = new ManagedDisplay.Dimensions(template.size);

        /**
         * The current mouse cursor, if any.
         * 
         * @type ManagedDisplay.Cursor
         */
        this.cursor = template.cursor;

    };

    /**
     * Object which represents the size of the Guacamole display.
     *
     * @constructor
     * @param {ManagedDisplay.Dimensions|Object} template
     *     The object whose properties should be copied within the new
     *     ManagedDisplay.Dimensions.
     */
    ManagedDisplay.Dimensions = function Dimensions(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The current width of the Guacamole display, in pixels.
         *
         * @type Number
         */
        this.width = template.width || 0;

        /**
         * The current width of the Guacamole display, in pixels.
         *
         * @type Number
         */
        this.height = template.height || 0;

    };

    /**
     * Object which represents a mouse cursor used by the Guacamole display.
     *
     * @constructor
     * @param {ManagedDisplay.Cursor|Object} template
     *     The object whose properties should be copied within the new
     *     ManagedDisplay.Cursor.
     */
    ManagedDisplay.Cursor = function Cursor(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The actual mouse cursor image.
         * 
         * @type HTMLCanvasElement
         */
        this.canvas = template.canvas;

        /**
         * The X coordinate of the cursor hotspot.
         * 
         * @type Number
         */
        this.x = template.x;

        /**
         * The Y coordinate of the cursor hotspot.
         * 
         * @type Number
         */
        this.y = template.y;

    };

    /**
     * Creates a new ManagedDisplay which represents the current state of the
     * given Guacamole display.
     * 
     * @param {Guacamole.Display} display
     *     The Guacamole display to represent. Changes to this display will
     *     affect this ManagedDisplay.
     *
     * @returns {ManagedDisplay}
     *     A new ManagedDisplay which represents the current state of the
     *     given Guacamole display.
     */
    ManagedDisplay.getInstance = function getInstance(display) {

        var managedDisplay = new ManagedDisplay({
            display : display
        });

        // Store changes to display size
        display.onresize = function setClientSize() {
            $rootScope.$apply(function updateClientSize() {
                managedDisplay.size = new ManagedDisplay.Dimensions({
                    width  : display.getWidth(),
                    height : display.getHeight()
                });
            });
        };

        // Store changes to display cursor
        display.oncursor = function setClientCursor(canvas, x, y) {
            $rootScope.$apply(function updateClientCursor() {
                managedDisplay.cursor = new ManagedDisplay.Cursor({
                    canvas : canvas,
                    x      : x,
                    y      : y
                });
            });
        };

        return managedDisplay;

    };

    return ManagedDisplay;

}]);