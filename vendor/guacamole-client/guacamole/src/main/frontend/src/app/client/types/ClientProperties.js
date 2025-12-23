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
 * A service for generating new guacClient properties objects.
 */
angular.module('client').factory('ClientProperties', ['$injector', function defineClientProperties($injector) {

    /**
     * Object used for interacting with a guacClient directive.
     * 
     * @constructor
     * @param {ClientProperties|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ClientProperties.
     */
    var ClientProperties = function ClientProperties(template) {

        // Use empty object by default
        template = template || {};

        /**
         * Whether the display should be scaled automatically to fit within the
         * available space.
         * 
         * @type Boolean
         */
        this.autoFit = template.autoFit || true;

        /**
         * The current scale. If autoFit is true, the effect of setting this
         * value is undefined.
         * 
         * @type Number
         */
        this.scale = template.scale || 1;

        /**
         * The minimum scale value.
         * 
         * @type Number
         */
        this.minScale = template.minScale || 1;

        /**
         * The maximum scale value.
         * 
         * @type Number
         */
        this.maxScale = template.maxScale || 3;

        /**
         * Whether this client should receive keyboard events.
         *
         * @type Boolean
         */
        this.focused = template.focused || false;

        /**
         * The relative Y coordinate of the scroll offset of the display within
         * the client element.
         * 
         * @type Number
         */
        this.scrollTop = template.scrollTop || 0;

        /**
         * The relative X coordinate of the scroll offset of the display within
         * the client element.
         * 
         * @type Number
         */
        this.scrollLeft = template.scrollLeft || 0;

    };

    return ClientProperties;

}]);