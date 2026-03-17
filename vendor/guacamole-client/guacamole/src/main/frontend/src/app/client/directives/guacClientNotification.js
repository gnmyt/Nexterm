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
 * A directive for displaying a non-global notification describing the status
 * of a specific Guacamole client, including prompts for any information
 * necessary to continue the connection.
 */
angular.module('client').directive('guacClientNotification', [function guacClientNotification() {

    const directive = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/client/templates/guacClientNotification.html'
    };

    directive.scope = {

        /**
         * The client whose status should be displayed.
         *
         * @type ManagedClient
         */
        client : '='

    };

    directive.controller = ['$scope', '$injector', '$element',
        function guacClientNotificationController($scope, $injector, $element) {

        // Required types
        const ManagedClient      = $injector.get('ManagedClient');
        const ManagedClientState = $injector.get('ManagedClientState');
        const Protocol           = $injector.get('Protocol');

        // Required services
        const $location              = $injector.get('$location');
        const authenticationService  = $injector.get('authenticationService');
        const guacClientManager      = $injector.get('guacClientManager');
        const guacTranslate          = $injector.get('guacTranslate');
        const requestService         = $injector.get('requestService');
        const userPageService        = $injector.get('userPageService');

        /**
         * A Notification object describing the client status to display as a
         * dialog or prompt, as would be accepted by guacNotification.showStatus(),
         * or false if no status should be shown.
         *
         * @type {Notification|Object|Boolean}
         */
        $scope.status = false;

        /**
         * All error codes for which automatic reconnection is appropriate when a
         * client error occurs.
         */
        const CLIENT_AUTO_RECONNECT = {
            0x0200: true,
            0x0202: true,
            0x0203: true,
            0x0207: true,
            0x0208: true,
            0x0301: true,
            0x0308: true
        };

        /**
         * All error codes for which automatic reconnection is appropriate when a
         * tunnel error occurs.
         */
        const TUNNEL_AUTO_RECONNECT = {
            0x0200: true,
            0x0202: true,
            0x0203: true,
            0x0207: true,
            0x0208: true,
            0x0308: true
        };

        /**
         * Action which logs out from Guacamole entirely.
         */
        const LOGOUT_ACTION = {
            name      : "CLIENT.ACTION_LOGOUT",
            className : "logout button",
            callback  : function logoutCallback() {
                authenticationService.logout()
                ['catch'](requestService.IGNORE);
            }
        };

        /**
         * Action which returns the user to the home screen. If the home page has
         * not yet been determined, this will be null.
         */
        let NAVIGATE_HOME_ACTION = null;

        // Assign home page action once user's home page has been determined
        userPageService.getHomePage()
        .then(function homePageRetrieved(homePage) {

            // Define home action only if different from current location
            if ($location.path() !== homePage.url) {
                NAVIGATE_HOME_ACTION = {
                    name      : "CLIENT.ACTION_NAVIGATE_HOME",
                    className : "home button",
                    callback  : function navigateHomeCallback() {
                        $location.url(homePage.url);
                    }
                };
            }

        }, requestService.WARN);

        /**
         * Action which replaces the current client with a newly-connected client.
         */
        const RECONNECT_ACTION = {
            name      : "CLIENT.ACTION_RECONNECT",
            className : "reconnect button",
            callback  : function reconnectCallback() {
                $scope.client = guacClientManager.replaceManagedClient($scope.client.id);
                $scope.status = false;
            }
        };

        /**
         * The reconnect countdown to display if an error or status warrants an
         * automatic, timed reconnect.
         */
        const RECONNECT_COUNTDOWN = {
            text: "CLIENT.TEXT_RECONNECT_COUNTDOWN",
            callback: RECONNECT_ACTION.callback,
            remaining: 15
        };

        /**
         * Displays a notification at the end of a Guacamole connection, whether
         * that connection is ending normally or due to an error. As the end of
         * a Guacamole connection may be due to changes in authentication status,
         * this will also implicitly peform a re-authentication attempt to check
         * for such changes, possibly resulting in auth-related events like
         * guacInvalidCredentials.
         *
         * @param {Notification|Boolean|Object} status
         *     The status notification to show, as would be accepted by
         *     guacNotification.showStatus().
         */
        const notifyConnectionClosed = function notifyConnectionClosed(status) {

            // Re-authenticate to verify auth status at end of connection
            authenticationService.updateCurrentToken($location.search())
            ['catch'](requestService.IGNORE)

            // Show the requested status once the authentication check has finished
            ['finally'](function authenticationCheckComplete() {
                $scope.status = status;
            });

        };

        /**
         * Notifies the user that the connection state has changed.
         *
         * @param {String} connectionState
         *     The current connection state, as defined by
         *     ManagedClientState.ConnectionState.
         */
        const notifyConnectionState = function notifyConnectionState(connectionState) {

            // Hide any existing status
            $scope.status = false;

            // Do not display status if status not known
            if (!connectionState)
                return;

            // Build array of available actions
            let actions;
            if (NAVIGATE_HOME_ACTION)
                actions = [ NAVIGATE_HOME_ACTION, RECONNECT_ACTION, LOGOUT_ACTION ];
            else
                actions = [ RECONNECT_ACTION, LOGOUT_ACTION ];

            // Get any associated status code
            const status = $scope.client.clientState.statusCode;

            // Connecting
            if (connectionState === ManagedClientState.ConnectionState.CONNECTING
             || connectionState === ManagedClientState.ConnectionState.WAITING) {
                $scope.status = {
                    className : "connecting",
                    title: "CLIENT.DIALOG_HEADER_CONNECTING",
                    text: {
                        key : "CLIENT.TEXT_CLIENT_STATUS_" + connectionState.toUpperCase()
                    }
                };
            }

            // Client error
            else if (connectionState === ManagedClientState.ConnectionState.CLIENT_ERROR) {

                // Translation IDs for this error code
                const errorPrefix = "CLIENT.ERROR_CLIENT_";
                const errorId = errorPrefix + status.toString(16).toUpperCase();
                const defaultErrorId = errorPrefix + "DEFAULT";

                // Determine whether the reconnect countdown applies
                const countdown = (status in CLIENT_AUTO_RECONNECT) ? RECONNECT_COUNTDOWN : null;

                // Use the guacTranslate service to determine if there is a translation for
                // this error code; if not, use the default
                guacTranslate(errorId, defaultErrorId).then(

                    // Show error status
                    translationResult => notifyConnectionClosed({
                        className : "error",
                        title     : "CLIENT.DIALOG_HEADER_CONNECTION_ERROR",
                        text      : {
                            key : translationResult.id
                        },
                        countdown : countdown,
                        actions   : actions
                    })
                );

            }

            // Tunnel error
            else if (connectionState === ManagedClientState.ConnectionState.TUNNEL_ERROR) {

                // Translation IDs for this error code
                const errorPrefix = "CLIENT.ERROR_TUNNEL_";
                const errorId = errorPrefix + status.toString(16).toUpperCase();
                const defaultErrorId = errorPrefix + "DEFAULT";

                // Determine whether the reconnect countdown applies
                const countdown = (status in TUNNEL_AUTO_RECONNECT) ? RECONNECT_COUNTDOWN : null;

                // Use the guacTranslate service to determine if there is a translation for
                // this error code; if not, use the default
                guacTranslate(errorId, defaultErrorId).then(

                    // Show error status
                    translationResult => notifyConnectionClosed({
                        className : "error",
                        title     : "CLIENT.DIALOG_HEADER_CONNECTION_ERROR",
                        text      : {
                            key : translationResult.id
                        },
                        countdown : countdown,
                        actions   : actions
                    })
                );

            }

            // Disconnected
            else if (connectionState === ManagedClientState.ConnectionState.DISCONNECTED) {
                notifyConnectionClosed({
                    title   : "CLIENT.DIALOG_HEADER_DISCONNECTED",
                    text    : {
                        key : "CLIENT.TEXT_CLIENT_STATUS_" + connectionState.toUpperCase()
                    },
                    actions : actions
                });
            }

            // Hide status for all other states
            else
                $scope.status = false;

        };

        /**
         * Prompts the user to enter additional connection parameters. If the
         * protocol and associated parameters of the underlying connection are not
         * yet known, this function has no effect and should be re-invoked once
         * the parameters are known.
         *
         * @param {Object.<String, String>} requiredParameters
         *     The set of all parameters requested by the server via "required"
         *     instructions, where each object key is the name of a requested
         *     parameter and each value is the current value entered by the user.
         */
        const notifyParametersRequired = function notifyParametersRequired(requiredParameters) {

            /**
             * Action which submits the current set of parameter values, requesting
             * that the connection continue.
             */
            const SUBMIT_PARAMETERS = {
                name      : "CLIENT.ACTION_CONTINUE",
                className : "button",
                callback  : function submitParameters() {
                    if ($scope.client) {
                        const params = $scope.client.requiredParameters;
                        $scope.client.requiredParameters = null;
                        ManagedClient.sendArguments($scope.client, params);
                    }
                }
            };

            /**
             * Action which cancels submission of additional parameters and
             * disconnects from the current connection.
             */
            const CANCEL_PARAMETER_SUBMISSION = {
                name      : "CLIENT.ACTION_CANCEL",
                className : "button",
                callback  : function cancelSubmission() {
                    $scope.client.requiredParameters = null;
                    $scope.client.client.disconnect();
                }
            };

            // Attempt to prompt for parameters only if the parameters that apply
            // to the underlying connection are known
            if (!$scope.client.protocol || !$scope.client.forms)
                return;

            // Prompt for parameters
            $scope.status = {
                className : "parameters-required",
                formNamespace : Protocol.getNamespace($scope.client.protocol),
                forms : $scope.client.forms,
                formModel : requiredParameters,
                formSubmitCallback : SUBMIT_PARAMETERS.callback,
                actions : [ SUBMIT_PARAMETERS, CANCEL_PARAMETER_SUBMISSION ]
            };

        };

        /**
         * Returns whether the given connection state allows for submission of
         * connection parameters via "argv" instructions.
         *
         * @param {String} connectionState
         *     The connection state to test, as defined by
         *     ManagedClientState.ConnectionState.
         *
         * @returns {boolean}
         *     true if the given connection state allows submission of connection
         *     parameters via "argv" instructions, false otherwise.
         */
        const canSubmitParameters = function canSubmitParameters(connectionState) {
            return (connectionState === ManagedClientState.ConnectionState.WAITING ||
                    connectionState === ManagedClientState.ConnectionState.CONNECTED);
        };

        // Show status dialog when connection status changes
        $scope.$watchGroup([
            'client.clientState.connectionState',
            'client.requiredParameters',
            'client.protocol',
            'client.forms'
        ], function clientStateChanged(newValues) {

            const connectionState = newValues[0];
            const requiredParameters = newValues[1];

            // Prompt for parameters only if parameters can actually be submitted
            if (requiredParameters && canSubmitParameters(connectionState))
                notifyParametersRequired(requiredParameters);

            // Otherwise, just show general connection state
            else
                notifyConnectionState(connectionState);

        });

        /**
         * Prevents the default behavior of the given AngularJS event if a
         * notification is currently shown and the client is focused.
         *
         * @param {event} e
         *     The AngularJS event to selectively prevent.
         */
        const preventDefaultDuringNotification = function preventDefaultDuringNotification(e) {
            if ($scope.status && $scope.client.clientProperties.focused)
                e.preventDefault();
        };

        // Block internal handling of key events (by the client) if a
        // notification is visible
        $scope.$on('guacBeforeKeydown', preventDefaultDuringNotification);
        $scope.$on('guacBeforeKeyup', preventDefaultDuringNotification);

    }];

    return directive;

}]);
