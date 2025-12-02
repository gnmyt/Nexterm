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
 * A position in 2-D space.
 *
 * @constructor
 * @param {Guacamole.Position|object} [template={}]
 *     The object whose properties should be copied within the new
 *     Guacamole.Position.
 */
Guacamole.Position = function Position(template) {

    template = template || {};

    /**
     * The current X position, in pixels.
     *
     * @type {!number}
     * @default 0
     */
    this.x = template.x || 0;

    /**
     * The current Y position, in pixels.
     *
     * @type {!number}
     * @default 0
     */
    this.y = template.y || 0;

    /**
     * Assigns the position represented by the given element and
     * clientX/clientY coordinates. The clientX and clientY coordinates are
     * relative to the browser viewport and are commonly available within
     * JavaScript event objects. The final position is translated to
     * coordinates that are relative the given element.
     *
     * @param {!Element} element
     *     The element the coordinates should be relative to.
     *
     * @param {!number} clientX
     *     The viewport-relative X coordinate to translate.
     *
     * @param {!number} clientY
     *     The viewport-relative Y coordinate to translate.
     */
    this.fromClientPosition = function fromClientPosition(element, clientX, clientY) {

        this.x = clientX - element.offsetLeft;
        this.y = clientY - element.offsetTop;

        // This is all JUST so we can get the position within the element
        var parent = element.offsetParent;
        while (parent && !(parent === document.body)) {
            this.x -= parent.offsetLeft - parent.scrollLeft;
            this.y -= parent.offsetTop  - parent.scrollTop;

            parent = parent.offsetParent;
        }

        // Element ultimately depends on positioning within document body,
        // take document scroll into account.
        if (parent) {
            var documentScrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
            var documentScrollTop = document.body.scrollTop || document.documentElement.scrollTop;

            this.x -= parent.offsetLeft - documentScrollLeft;
            this.y -= parent.offsetTop  - documentScrollTop;
        }

    };

};

/**
 * Returns a new {@link Guacamole.Position} representing the relative position
 * of the given clientX/clientY coordinates within the given element. The
 * clientX and clientY coordinates are relative to the browser viewport and are
 * commonly available within JavaScript event objects. The final position is
 * translated to  coordinates that are relative the given element.
 *
 * @param {!Element} element
 *     The element the coordinates should be relative to.
 *
 * @param {!number} clientX
 *     The viewport-relative X coordinate to translate.
 *
 * @param {!number} clientY
 *     The viewport-relative Y coordinate to translate.
 *
 * @returns {!Guacamole.Position}
 *     A new Guacamole.Position representing the relative position of the given
 *     client coordinates.
 */
Guacamole.Position.fromClientPosition = function fromClientPosition(element, clientX, clientY) {
    var position = new Guacamole.Position();
    position.fromClientPosition(element, clientX, clientY);
    return position;
};
