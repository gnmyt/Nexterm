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
 * Provides the NotificationAction class definition.
 */
angular.module('notification').factory('NotificationAction', [function defineNotificationAction() {

    /**
     * Creates a new NotificationAction, which pairs an arbitrary callback with
     * an action name. The name of this action will ultimately be presented to
     * the user when the user is prompted to choose among available actions.
     *
     * @constructor
     * @param {String} name The name of this action.
     *
     * @param {Function} callback
     *     The callback to call when the user elects to perform this action.
     * 
     * @param {String} className
     *     The CSS class to associate with this action, if any.
     */
    var NotificationAction = function NotificationAction(name, callback, className) {

        /**
         * Reference to this NotificationAction.
         *
         * @type NotificationAction
         */
        var action = this;

        /**
         * The CSS class associated with this action.
         * 
         * @type String
         */
        this.className = className;

        /**
         * The name of this action.
         *
         * @type String
         */
        this.name = name;

        /**
         * The callback to call when this action is performed.
         *
         * @type Function
         */
        this.callback = callback;

    };

    return NotificationAction;

}]);
