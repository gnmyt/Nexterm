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
 * Provides the ScrollState class definition.
 */
angular.module('element').factory('ScrollState', [function defineScrollState() {

    /**
     * Creates a new ScrollState, representing the current scroll position of
     * an arbitrary element. This constructor initializes the properties of the
     * new ScrollState with the corresponding properties of the given template.
     *
     * @constructor
     * @param {ScrollState|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ScrollState.
     */
    var ScrollState = function ScrollState(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The left edge of the view rectangle within the scrollable area. This
         * value naturally increases as the user scrolls right.
         *
         * @type Number
         */
        this.left = template.left || 0;

        /**
         * The top edge of the view rectangle within the scrollable area. This
         * value naturally increases as the user scrolls down.
         *
         * @type Number
         */
        this.top = template.top || 0;

    };

    return ScrollState;

}]);
