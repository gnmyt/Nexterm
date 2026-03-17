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
 * The controller for the root of the application.
 */
angular.module('index').controller('indexController', ['$scope', '$injector',
        function indexController($scope, $injector) {

    /**
     * The number of milliseconds that should elapse between client-side
     * session checks. This DOES NOT impact whether a session expires at all;
     * such checks will always be server-side. This only affects how quickly
     * the client-side view can recognize that a user's session has expired
     * absent any action taken by the user.
     *
     * @type {!number}
     */
    const SESSION_VALIDITY_RECHECK_INTERVAL = 15000;

    // Required types
    const Error              = $injector.get('Error');
    const ManagedClientState = $injector.get('ManagedClientState');

    // Required services
    const $document              = $injector.get('$document');
    const $interval              = $injector.get('$interval');
    const $location              = $injector.get('$location');
    const $route                 = $injector.get('$route');
    const $window                = $injector.get('$window');
    const authenticationService  = $injector.get('authenticationService');
    const clipboardService       = $injector.get('clipboardService');
    const guacNotification       = $injector.get('guacNotification');
    const guacClientManager      = $injector.get('guacClientManager');

    /**
     * The error that prevents the current page from rendering at all. If no
     * such error has occurred, this will be null.
     *
     * @type Error
     */
    $scope.fatalError = null;

    /**
     * The notification service.
     */
    $scope.guacNotification = guacNotification;

    /**
     * All currently-active connections, grouped into their corresponding
     * tiled views.
     *
     * @type ManagedClientGroup[]
     */
    $scope.getManagedClientGroups = guacClientManager.getManagedClientGroups;

    /**
     * The message to display to the user as instructions for the login
     * process.
     *
     * @type TranslatableMessage
     */
    $scope.loginHelpText = null;

    /**
     * Whether the user has selected to log back in after having logged out.
     *
     * @type boolean
     */
    $scope.reAuthenticating = false;

    /**
     * The credentials that the authentication service is has already accepted,
     * pending additional credentials, if any. If the user is logged in, or no
     * credentials have been accepted, this will be null. If credentials have
     * been accepted, this will be a map of name/value pairs corresponding to
     * the parameters submitted in a previous authentication attempt.
     *
     * @type Object.<String, String>
     */
    $scope.acceptedCredentials = null;

    /**
     * The credentials that the authentication service is currently expecting,
     * if any. If the user is logged in, this will be null.
     *
     * @type Field[]
     */
    $scope.expectedCredentials = null;

    /**
     * Possible overall states of the client side of the web application.
     *
     * @enum {string}
     */
    var ApplicationState = {

        /**
         * A non-interactive authentication attempt failed.
         */
        AUTOMATIC_LOGIN_REJECTED : 'automaticLoginRejected',

        /**
         * The application has fully loaded but is awaiting credentials from
         * the user before proceeding.
         */
        AWAITING_CREDENTIALS : 'awaitingCredentials',

        /**
         * A fatal error has occurred that will prevent the client side of the
         * application from functioning properly.
         */
        FATAL_ERROR : 'fatalError',

        /**
         * The application has just started within the user's browser and has
         * not yet settled into any specific state.
         */
        LOADING : 'loading',

        /**
         * The user has manually logged out.
         */
        LOGGED_OUT : 'loggedOut',

        /**
         * The application has fully loaded and the user has logged in
         */
        READY : 'ready'

    };

    /**
     * The current overall state of the client side of the application.
     * Possible values are defined by {@link ApplicationState}.
     *
     * @type string
     */
    $scope.applicationState = ApplicationState.LOADING;

    /**
     * Basic page-level information.
     */
    $scope.page = {

        /**
         * The title of the page.
         * 
         * @type String
         */
        title: '',

        /**
         * The name of the CSS class to apply to the page body, if any.
         *
         * @type String
         */
        bodyClassName: ''

    };

    // Add default destination for input events
    var sink = new Guacamole.InputSink();
    $document[0].body.appendChild(sink.getElement());

    // Create event listeners at the global level
    var keyboard = new Guacamole.Keyboard($document[0]);
    keyboard.listenTo(sink.getElement());

    // Broadcast keydown events
    keyboard.onkeydown = function onkeydown(keysym) {

        // Do not handle key events if not logged in
        if ($scope.applicationState !== ApplicationState.READY)
            return true;

        // Warn of pending keydown
        var guacBeforeKeydownEvent = $scope.$broadcast('guacBeforeKeydown', keysym, keyboard);
        if (guacBeforeKeydownEvent.defaultPrevented)
            return true;

        // If not prevented via guacBeforeKeydown, fire corresponding keydown event
        var guacKeydownEvent = $scope.$broadcast('guacKeydown', keysym, keyboard);
        return !guacKeydownEvent.defaultPrevented;

    };
    
    // Broadcast keyup events
    keyboard.onkeyup = function onkeyup(keysym) {

        // Do not handle key events if not logged in or if a notification is
        // shown
        if ($scope.applicationState !== ApplicationState.READY)
            return;

        // Warn of pending keyup
        var guacBeforeKeydownEvent = $scope.$broadcast('guacBeforeKeyup', keysym, keyboard);
        if (guacBeforeKeydownEvent.defaultPrevented)
            return;

        // If not prevented via guacBeforeKeyup, fire corresponding keydown event
        $scope.$broadcast('guacKeyup', keysym, keyboard);

    };

    // Release all keys when window loses focus
    $window.onblur = function () {
        keyboard.reset();
    };

    /**
     * Returns whether the current user has at least one active connection
     * running within the current tab.
     *
     * @returns {!boolean}
     *     true if the current user has at least one active connection running
     *     in the current browser tab, false otherwise.
     */
    var hasActiveTunnel = function hasActiveTunnel() {

        var clients = guacClientManager.getManagedClients();
        for (var id in clients) {

            switch (clients[id].clientState.connectionState) {
                case ManagedClientState.ConnectionState.CONNECTING:
                case ManagedClientState.ConnectionState.WAITING:
                case ManagedClientState.ConnectionState.CONNECTED:
                    return true;
            }

        }

        return false;

    };

    // If we're logged in and not connected to anything, periodically check
    // whether the current session is still valid. If the session has expired,
    // refresh the auth state to reshow the login screen (rather than wait for
    // the user to take some action and discover that they are not logged in
    // after all). There is no need to do this if a connection is active as
    // that connection activity will already automatically check session
    // validity.
    $interval(function cleanUpViewIfSessionInvalid() {
        if (!!authenticationService.getCurrentToken() && !hasActiveTunnel()) {
            authenticationService.getValidity().then(function validityDetermined(valid) {
                if (!valid)
                    $scope.reAuthenticate();
            });
        }
    }, SESSION_VALIDITY_RECHECK_INTERVAL);

    // Release all keys upon form submission (there may not be corresponding
    // keyup events for key presses involved in submitting a form)
    $document.on('submit', function formSubmitted() {
        keyboard.reset();
    });

    // Attempt to read the clipboard if it may have changed
    $window.addEventListener('load',  clipboardService.resyncClipboard, true);
    $window.addEventListener('copy',  clipboardService.resyncClipboard);
    $window.addEventListener('cut',   clipboardService.resyncClipboard);
    $window.addEventListener('focus', function focusGained(e) {

        // Only recheck clipboard if it's the window itself that gained focus
        if (e.target === $window)
            clipboardService.resyncClipboard();

    }, true);

    /**
     * Sets the current overall state of the client side of the
     * application to the given value. Possible values are defined by
     * {@link ApplicationState}. The title and class associated with the
     * current page are automatically reset to the standard values applicable
     * to the application as a whole (rather than any specific page).
     *
     * @param {!string} state
     *     The state to assign, as defined by {@link ApplicationState}.
     */
    const setApplicationState = function setApplicationState(state) {
        $scope.applicationState = state;
        $scope.page.title = 'APP.NAME';
        $scope.page.bodyClassName = '';
    };

    /**
     * Navigates the user back to the root of the application (or reloads the
     * current route and controller if the user is already there), effectively
     * forcing reauthentication. If the user is not logged in, this will result
     * in the login screen appearing.
     */
    $scope.reAuthenticate = function reAuthenticate() {

        $scope.reAuthenticating = true;

        // Clear out URL state to conveniently bring user back to home screen
        // upon relogin
        if ($location.path() !== '/')
            $location.url('/');
        else
            $route.reload();

    };

    // Display login screen if a whole new set of credentials is needed
    $scope.$on('guacInvalidCredentials', function loginInvalid(event, parameters, error) {

        setApplicationState(ApplicationState.AWAITING_CREDENTIALS);

        $scope.loginHelpText = null;
        $scope.acceptedCredentials = {};
        $scope.expectedCredentials = error.expected;

    });

    // Prompt for remaining credentials if provided credentials were not enough
    $scope.$on('guacInsufficientCredentials', function loginInsufficient(event, parameters, error) {

        setApplicationState(ApplicationState.AWAITING_CREDENTIALS);

        $scope.loginHelpText = error.translatableMessage;
        $scope.acceptedCredentials = parameters;
        $scope.expectedCredentials = error.expected;

    });

    // Alert user to authentication errors that occur in the absence of an
    // interactive login form
    $scope.$on('guacLoginFailed', function loginFailed(event, parameters, error) {

        // All errors related to an interactive login form are handled elsewhere
        if ($scope.applicationState === ApplicationState.AWAITING_CREDENTIALS
                || error.type === Error.Type.INSUFFICIENT_CREDENTIALS
                || error.type === Error.Type.INVALID_CREDENTIALS)
            return;

        setApplicationState(ApplicationState.AUTOMATIC_LOGIN_REJECTED);
        $scope.reAuthenticating = false;
        $scope.fatalError = error;

    });

    // Replace absolutely all content with an error message if the page itself
    // cannot be displayed due to an error
    $scope.$on('guacFatalPageError', function fatalPageError(error) {
        setApplicationState(ApplicationState.FATAL_ERROR);
        $scope.fatalError = error;
    });

    // Replace the overall user interface with an informational message if the
    // user has manually logged out
    $scope.$on('guacLogout', function loggedOut() {
        $scope.applicationState = ApplicationState.LOGGED_OUT;
        $scope.reAuthenticating = false;
    });

    // Ensure new pages always start with clear keyboard state
    $scope.$on('$routeChangeStart', function routeChanging() {
        keyboard.reset();
    });

    // Update title and CSS class upon navigation
    $scope.$on('$routeChangeSuccess', function(event, current, previous) {
       
        // If the current route is available
        if (current.$$route) {

            // Clear login screen if route change was successful (and thus
            // login was either successful or not required)
            $scope.applicationState = ApplicationState.READY;

            // Set title
            var title = current.$$route.title;
            if (title)
                $scope.page.title = title;

            // Set body CSS class
            $scope.page.bodyClassName = current.$$route.bodyClassName || '';
        }

    });

}]);
