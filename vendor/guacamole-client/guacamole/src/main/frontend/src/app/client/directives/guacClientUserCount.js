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
 * A directive that displays a status indicator showing the number of users
 * joined to a connection. The specific usernames of those users are visible in
 * a tooltip on mouseover, and small notifications are displayed as users
 * join/leave the connection.
 */
angular.module('client').directive('guacClientUserCount', [function guacClientUserCount() {

    const directive = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/client/templates/guacClientUserCount.html'
    };

    directive.scope = {

        /**
         * The client whose current users should be displayed.
         * 
         * @type ManagedClient
         */
        client : '='
        
    };

    directive.controller = ['$scope', '$injector', '$element',
        function guacClientUserCountController($scope, $injector, $element) {

        // Required types
        var AuthenticationResult = $injector.get('AuthenticationResult');

        // Required services
        var $translate = $injector.get('$translate');

        /**
         * The maximum number of messages displayed by this directive at any
         * given time. Old messages will be discarded as necessary to ensure
         * the number of messages displayed never exceeds this value.
         *
         * @constant
         * @type number
         */
        var MAX_MESSAGES = 3;

        /**
         * The list that should contain any notifications regarding users
         * joining or leaving the connection.
         *
         * @type HTMLUListElement
         */
        var messages = $element.find('.client-user-count-messages')[0];

        /**
         * Map of the usernames of all users of the current connection to the
         * number of concurrent connections those users have to the current
         * connection.
         *
         * @type Object.<string, number>
         */
        $scope.userCounts = {};

        /**
         * Displays a message noting that a change related to a particular user
         * of this connection has occurred.
         *
         * @param {!string} str
         *     The key of the translation string containing the message to
         *     display. This translation key must accept "USERNAME" as the
         *     name of the translation parameter containing the username of
         *     the user in question.
         *
         * @param {!string} username
         *     The username of the user in question.
         */
        var notify = function notify(str, username) {
            $translate(str, { 'USERNAME' : username }).then(function translationReady(text) {

                if (messages.childNodes.length === 3)
                    messages.removeChild(messages.lastChild);

                var message = document.createElement('li');
                message.className = 'client-user-count-message';
                message.textContent = text;
                messages.insertBefore(message, messages.firstChild);

                // Automatically remove the notification after its "fadeout"
                // animation ends. NOTE: This will not fire if the element is
                // not visible at all.
                message.addEventListener('animationend', function animationEnded() {
                    messages.removeChild(message);
                });

            });
        };

        /**
         * Displays a message noting that a particular user has joined the
         * current connection.
         * 
         * @param {!string} username
         *     The username of the user that joined.
         */
        var notifyUserJoined = function notifyUserJoined(username) {
            if ($scope.isAnonymous(username))
                notify('CLIENT.TEXT_ANONYMOUS_USER_JOINED', username);
            else
                notify('CLIENT.TEXT_USER_JOINED', username);
        };

        /**
         * Displays a message noting that a particular user has left the
         * current connection.
         * 
         * @param {!string} username
         *     The username of the user that left.
         */
        var notifyUserLeft = function notifyUserLeft(username) {
            if ($scope.isAnonymous(username))
                notify('CLIENT.TEXT_ANONYMOUS_USER_LEFT', username);
            else
                notify('CLIENT.TEXT_USER_LEFT', username);
        };

        /**
         * The ManagedClient attached to this directive at the time the
         * notification update scope watch was last invoked. This is necessary
         * as $scope.$watchGroup() does not allow for the callback to know
         * whether the scope was previously uninitialized (it's "oldValues"
         * parameter receives a copy of the new values if there are no old
         * values).
         *
         * @type ManagedClient
         */
        var oldClient = null;

        /**
         * Returns whether the given username represents an anonymous user.
         *
         * @param {!string} username
         *     The username of the user to check.
         *
         * @returns {!boolean}
         *     true if the given username represents an anonymous user, false
         *     otherwise.
         */
        $scope.isAnonymous = function isAnonymous(username) {
            return username === AuthenticationResult.ANONYMOUS_USERNAME;
        };

        /**
         * Returns the translation key of the translation string that should be
         * used to render the number of connections a user with the given
         * username has to the current connection. The appropriate string will
         * vary by whether the user is anonymous.
         *
         * @param {!string} username
         *     The username of the user to check.
         *
         * @returns {!string}
         *     The translation key of the translation string that should be
         *     used to render the number of connections the user with the given
         *     username has to the current connection.
         */
        $scope.getUserCountTranslationKey = function getUserCountTranslationKey(username) {
            return $scope.isAnonymous(username) ? 'CLIENT.INFO_ANONYMOUS_USER_COUNT' : 'CLIENT.INFO_USER_COUNT';
        };

        // Update visible notifications as users join/leave
        $scope.$watchGroup([ 'client', 'client.userCount' ], function usersChanged() {

            // Resynchronize directive with state of any attached client when
            // the client changes, to ensure notifications are only shown for
            // future changes in users present
            if (oldClient !== $scope.client) {

                $scope.userCounts = {};
                oldClient = $scope.client;

                angular.forEach($scope.client.users, function initUsers(connections, username) {
                    var count = Object.keys(connections).length;
                    $scope.userCounts[username] = count;
                });

                return;

            }

            // Display join/leave notifications for users who are currently
            // connected but whose connection counts have changed
            angular.forEach($scope.client.users, function addNewUsers(connections, username) {

                var count = Object.keys(connections).length;
                var known = $scope.userCounts[username] || 0;

                if (count > known)
                    notifyUserJoined(username);
                else if (count < known)
                    notifyUserLeft(username);

                $scope.userCounts[username] = count;

            });

            // Display leave notifications for users who are no longer connected
            angular.forEach($scope.userCounts, function removeOldUsers(count, username) {
                if (!$scope.client.users[username]) {
                    notifyUserLeft(username);
                    delete $scope.userCounts[username];
                }
            });

        });

    }];

    return directive;

}]);
