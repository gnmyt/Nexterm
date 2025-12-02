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

/**
 * A service for formatting time, specifically for the recording player.
 */
angular.module('player').factory('playerTimeService',
        ['$injector', function playerTimeService($injector) {

    const service = {};

    /**
     * Formats the given number as a decimal string, adding leading zeroes
     * such that the string contains at least two digits. The given number
     * MUST NOT be negative.
     *
     * @param {!number} value
     *     The number to format.
     *
     * @returns {!string}
     *     The decimal string representation of the given value, padded
     *     with leading zeroes up to a minimum length of two digits.
     */
    const zeroPad = function zeroPad(value) {
        return value > 9 ? value : '0' + value;
    };

    /**
     * Formats the given quantity of milliseconds as days, hours, minutes,
     * and whole seconds, separated by colons (DD:HH:MM:SS). Hours are
     * included only if the quantity is at least one hour, and days are
     * included only if the quantity is at least one day. All included
     * groups are zero-padded to two digits with the exception of the
     * left-most group.
     *
     * @param {!number} value
     *     The time to format, in milliseconds.
     *
     * @returns {!string}
     *     The given quantity of milliseconds formatted as "DD:HH:MM:SS".
     */
    service.formatTime = function formatTime(value) {

        // Round provided value down to whole seconds
        value = Math.floor((value || 0) / 1000);

        // Separate seconds into logical groups of seconds, minutes,
        // hours, etc.
        var groups = [ 1, 24, 60, 60 ];
        for (var i = groups.length - 1; i >= 0; i--) {
            var placeValue = groups[i];
            groups[i] = zeroPad(value % placeValue);
            value = Math.floor(value / placeValue);
        }

        // Format groups separated by colons, stripping leading zeroes and
        // groups which are entirely zeroes, leaving at least minutes and
        // seconds
        var formatted = groups.join(':');
        return /^[0:]*([0-9]{1,2}(?::[0-9]{2})+)$/.exec(formatted)[1];

    };

    return service;

}]);
