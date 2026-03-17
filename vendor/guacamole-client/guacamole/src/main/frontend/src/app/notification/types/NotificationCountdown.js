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
 * Provides the NotificationCountdown class definition.
 */
angular.module('notification').factory('NotificationCountdown', [function defineNotificationCountdown() {

    /**
     * Creates a new NotificationCountdown which describes an action that
     * should be performed after a specific number of seconds has elapsed.
     *
     * @constructor
     * @param {String} text The body text of the notification countdown.
     *
     * @param {Number} remaining
     *     The number of seconds remaining in the countdown.
     *
     * @param {Function} [callback]
     *     The callback to call when the countdown elapses.
     */
    var NotificationCountdown = function NotificationCountdown(text, remaining, callback) {

        /**
         * Reference to this NotificationCountdown.
         *
         * @type NotificationCountdown
         */
        var countdown = this;

        /**
         * The body text of the notification countdown. For the sake of i18n,
         * the variable REMAINING should be applied within the translation
         * string for formatting plurals, etc.
         *
         * @type String
         */
        this.text = text;

        /**
         * The number of seconds remaining in the countdown. After this number
         * of seconds elapses, the callback associated with this
         * NotificationCountdown will be called.
         *
         * @type Number
         */
        this.remaining = remaining;

        /**
         * The callback to call when this countdown expires.
         *
         * @type Function
         */
        this.callback = callback;

    };

    return NotificationCountdown;

}]);
