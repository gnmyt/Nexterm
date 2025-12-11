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
 * A service for authenticating a user against the REST API. Invoking the
 * authenticate() or login() functions of this service will automatically
 * affect the login dialog, if visible.
 *
 * This service broadcasts events on $rootScope depending on the status and
 * result of authentication operations:
 *
 *  "guacLoginPending"
 *      An authentication request is being submitted and we are awaiting the
 *      result. The request may not yet have been submitted if the parameters
 *      for that request are not ready. This event receives a promise that
 *      resolves with the HTTP parameters that were ultimately submitted as its
 *      sole parameter.
 *
 *  "guacLogin"
 *      Authentication was successful and a new token was created. This event
 *      receives the authentication token as its sole parameter.
 *
 *  "guacLogout"
 *      An existing token is being destroyed. This event receives the
 *      authentication token as its sole parameter. If the existing token for
 *      the current session is being replaced without destroying that session,
 *      this event is not fired.
 *
 *  "guacLoginFailed"
 *      An authentication request has failed for any reason. This event is
 *      broadcast before any other events that are specific to the nature of
 *      the failure, and may be used to detect login failures in lieu of those
 *      events. This event receives two parameters: the HTTP parameters
 *      submitted and the Error object received from the REST endpoint.
 *
 *  "guacInsufficientCredentials"
 *      An authentication request failed because additional credentials are
 *      needed before the request can be processed. This event receives two
 *      parameters: the HTTP parameters submitted and the Error object received
 *      from the REST endpoint.
 *
 *  "guacInvalidCredentials"
 *      An authentication request failed because the credentials provided are
 *      invalid. This event receives two parameters: the HTTP parameters
 *      submitted and the Error object received from the REST endpoint.
 */
angular.module('auth').factory('authenticationService', ['$injector',
        function authenticationService($injector) {

    // Required types
    var AuthenticationResult = $injector.get('AuthenticationResult');
    var Error                = $injector.get('Error');

    // Required services
    var $q                  = $injector.get('$q');
    var $rootScope          = $injector.get('$rootScope');
    var localStorageService = $injector.get('localStorageService');
    var requestService      = $injector.get('requestService');

    var service = {};

    /**
     * The most recent authentication result, or null if no authentication
     * result is cached.
     *
     * @type AuthenticationResult
     */
    var cachedResult = null;

    /**
     * The unique identifier of the local storage key which stores the latest
     * authentication token.
     *
     * @type String
     */
    var AUTH_TOKEN_STORAGE_KEY = 'GUAC_AUTH_TOKEN';

    /**
     * Retrieves the authentication result cached in memory. If the user has not
     * yet authenticated, the user has logged out, or the last authentication
     * attempt failed, null is returned.
     *
     * NOTE: setAuthenticationResult() will be called upon page load, so the
     * cache should always be populated after the page has successfully loaded.
     *
     * @returns {AuthenticationResult}
     *     The last successful authentication result, or null if the user is not
     *     currently authenticated.
     */
    var getAuthenticationResult = function getAuthenticationResult() {

        // Use cached result, if any
        if (cachedResult)
            return cachedResult;

        // Return explicit null if no auth data is currently stored
        return null;

    };

    /**
     * Stores the given authentication result for future retrieval. The given
     * result MUST be the result of the most recent authentication attempt.
     *
     * @param {AuthenticationResult} data
     *     The last successful authentication result, or null if the last
     *     authentication attempt failed.
     */
    var setAuthenticationResult = function setAuthenticationResult(data) {

        // Clear the currently-stored result and auth token if the last
        // attempt failed
        if (!data) {
            cachedResult = null;
            localStorageService.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }

        // Otherwise, store the authentication attempt directly.
        // Note that only the auth token is stored in persistent local storage.
        // To re-obtain an autentication result upon a fresh page load,
        // reauthenticate with the persistent token, which can be obtained by
        // calling getCurrentToken().
        else {

            // Always store in cache
            cachedResult = data;

            // Persist only the auth token past tab/window closure, and only
            // if not anonymous
            if (data.username !== AuthenticationResult.ANONYMOUS_USERNAME)
                localStorageService.setItem(
                        AUTH_TOKEN_STORAGE_KEY, data.authToken);

        }

    };

    /**
     * Clears the stored authentication result, if any. If no authentication
     * result is currently stored, this function has no effect.
     */
    var clearAuthenticationResult = function clearAuthenticationResult() {
        setAuthenticationResult(null);
    };

    /**
     * Makes a request to authenticate a user using the token REST API endpoint
     * and given arbitrary parameters, returning a promise that succeeds only
     * if the authentication operation was successful. The resulting
     * authentication data can be retrieved later via getCurrentToken() or
     * getCurrentUsername(). Invoking this function will affect the UI,
     * including the login screen if visible.
     * 
     * The provided parameters can be virtually any object, as each property
     * will be sent as an HTTP parameter in the authentication request.
     * Standard parameters include "username" for the user's username,
     * "password" for the user's associated password, and "token" for the
     * auth token to check/update.
     * 
     * If a token is provided, it will be reused if possible.
     * 
     * @param {Object|Promise} parameters
     *     Arbitrary parameters to authenticate with. If a Promise is provided,
     *     that Promise must resolve with the parameters to be submitted when
     *     those parameters are available, and any error will be handled as if
     *     from the authentication endpoint of the REST API itself.
     *
     * @returns {Promise}
     *     A promise which succeeds only if the login operation was successful.
     */
    service.authenticate = function authenticate(parameters) {

        // Coerce received parameters object into a Promise, if it isn't
        // already a Promise
        parameters = $q.resolve(parameters);

        // Notify that a fresh authentication request is underway
        $rootScope.$broadcast('guacLoginPending', parameters);

        // Attempt authentication after auth parameters are available ...
        return parameters.then(function requestParametersReady(requestParams) {

            // Strip any properties that are from AngularJS core, such as the
            // '$$state' property added by $q. Properties added by AngularJS
            // core will have a '$' prefix. The '$$state' property is
            // particularly problematic, as it is self-referential and explodes
            // the stack when fed to $.param().
            requestParams = _.omitBy(requestParams, (value, key) => key.startsWith('$'));

            return requestService({
                method: 'POST',
                url: 'api/tokens',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: $.param(requestParams)
            })

            // ... if authentication succeeds, handle received auth data ...
            .then(function authenticationSuccessful(data) {

                var currentToken = service.getCurrentToken();

                // If a new token was received, ensure the old token is invalidated,
                // if any, and notify listeners of the new token
                if (data.authToken !== currentToken) {

                    // If an old token existed, request that the token be revoked
                    if (currentToken) {
                        service.revokeToken(currentToken).catch(angular.noop);
                    }

                    // Notify of login and new token
                    setAuthenticationResult(new AuthenticationResult(data));
                    $rootScope.$broadcast('guacLogin', data.authToken);

                }

                // Update cached authentication result, even if the token remains
                // the same
                else
                    setAuthenticationResult(new AuthenticationResult(data));

                // Authentication was successful
                return data;

            });

        })

        // ... if authentication fails, propogate failure to returned promise
        ['catch'](requestService.createErrorCallback(function authenticationFailed(error) {

            // Notify of generic login failure, for any event consumers that
            // wish to handle all types of failures at once
            $rootScope.$broadcast('guacLoginFailed', parameters, error);

            // Request credentials if provided credentials were invalid
            if (error.type === Error.Type.INVALID_CREDENTIALS) {
                $rootScope.$broadcast('guacInvalidCredentials', parameters, error);
                clearAuthenticationResult();
            }

            // Request more credentials if provided credentials were not enough 
            else if (error.type === Error.Type.INSUFFICIENT_CREDENTIALS) {
                $rootScope.$broadcast('guacInsufficientCredentials', parameters, error);
                clearAuthenticationResult();
            }

            // Abort rendering of page if an internal error occurs
            else if (error.type === Error.Type.INTERNAL_ERROR)
                $rootScope.$broadcast('guacFatalPageError', error);

            // Authentication failed
            throw error;

        }));

    };

    /**
     * Makes a request to update the current auth token, if any, using the
     * token REST API endpoint. If the optional parameters object is provided,
     * its properties will be included as parameters in the update request.
     * This function returns a promise that succeeds only if the authentication
     * operation was successful. The resulting authentication data can be
     * retrieved later via getCurrentToken() or getCurrentUsername().
     * 
     * If there is no current auth token, this function behaves identically to
     * authenticate(), and makes a general authentication request.
     * 
     * @param {Object} [parameters]
     *     Arbitrary parameters to authenticate with, if any.
     *
     * @returns {Promise}
     *     A promise which succeeds only if the login operation was successful.
     */
    service.updateCurrentToken = function updateCurrentToken(parameters) {

        // HTTP parameters for the authentication request
        var httpParameters = {};

        // Add token parameter if current token is known
        var token = service.getCurrentToken();
        if (token)
            httpParameters.token = service.getCurrentToken();

        // Add any additional parameters
        if (parameters)
            angular.extend(httpParameters, parameters);

        // Make the request
        return service.authenticate(httpParameters);

    };

    /**
     * Determines whether the session associated with a particular token is
     * still valid, without performing an operation that would result in that
     * session being marked as active. If no token is provided, the session of
     * the current user is checked.
     *
     * @param {string} [token]
     *     The authentication token to pass with the "Guacamole-Token" header.
     *     If omitted, and the user is logged in, the user's current
     *     authentication token will be used.
     *
     * @returns {Promise.<!boolean>}
     *     A promise that resolves with the boolean value "true" if the session
     *     is valid, and resolves with the boolean value "false" otherwise,
     *     including if an error prevents session validity from being
     *     determined. The promise is never rejected.
     */
    service.getValidity = function getValidity(token) {

        // NOTE: Because this is a HEAD request, we will not receive a JSON
        // response body. We will only have a simple yes/no regarding whether
        // the auth token can be expected to be usable.
        return service.request({
            method: 'HEAD',
            url: 'api/session'
        }, token)

        .then(function sessionIsValid() {
            return true;
        })

        ['catch'](function sessionIsNotValid() {
            return false;
        });

    };

    /**
     * Makes a request to revoke an authentication token using the token REST
     * API endpoint, returning a promise that succeeds only if the token was
     * successfully revoked.
     *
     * @param {string} token
     *     The authentication token to revoke.
     *
     * @returns {Promise}
     *     A promise which succeeds only if the token was successfully revoked.
     */
    service.revokeToken = function revokeToken(token) {
        return service.request({
            method: 'DELETE',
            url: 'api/session'
        }, token);
    };

    /**
     * Makes a request to authenticate a user using the token REST API endpoint
     * with a username and password, ignoring any currently-stored token, 
     * returning a promise that succeeds only if the login operation was
     * successful. The resulting authentication data can be retrieved later
     * via getCurrentToken() or getCurrentUsername(). Invoking this function
     * will affect the UI, including the login screen if visible.
     * 
     * @param {String} username
     *     The username to log in with.
     *
     * @param {String} password
     *     The password to log in with.
     *
     * @returns {Promise}
     *     A promise which succeeds only if the login operation was successful.
     */
    service.login = function login(username, password) {
        return service.authenticate({
            username: username,
            password: password
        });
    };

    /**
     * Makes a request to logout a user using the token REST API endpoint,
     * returning a promise that succeeds only if the logout operation was
     * successful. Invoking this function will affect the UI, causing the
     * visible components of the application to be replaced with a status
     * message noting that the user has been logged out.
     * 
     * @returns {Promise}
     *     A promise which succeeds only if the logout operation was
     *     successful.
     */
    service.logout = function logout() {

        // Clear authentication data
        var token = service.getCurrentToken();
        clearAuthenticationResult();

        // Notify listeners that a token is being destroyed
        $rootScope.$broadcast('guacLogout', token);

        // Delete old token
        return service.revokeToken(token);

    };

    /**
     * Returns whether the current user has authenticated anonymously. An
     * anonymous user is denoted by the identifier reserved by the Guacamole
     * extension API for anonymous users (the empty string).
     *
     * @returns {Boolean}
     *     true if the current user has authenticated anonymously, false
     *     otherwise.
     */
    service.isAnonymous = function isAnonymous() {
        return service.getCurrentUsername() === '';
    };

    /**
     * Returns the username of the current user. If the current user is not
     * logged in, this value may not be valid.
     *
     * @returns {String}
     *     The username of the current user, or null if no authentication data
     *     is present.
     */
    service.getCurrentUsername = function getCurrentUsername() {

        // Return username, if available
        var authData = getAuthenticationResult();
        if (authData)
            return authData.username;

        // No auth data present
        return null;

    };

    /**
     * Returns the auth token associated with the current user. If the current
     * user is not logged in, this token may not be valid.
     *
     * @returns {String}
     *     The auth token associated with the current user, or null if no
     *     authentication data is present.
     */
    service.getCurrentToken = function getCurrentToken() {

        // Return cached auth token, if available
        var authData = getAuthenticationResult();
        if (authData)
            return authData.authToken;

        // Fall back to the value from local storage if not found in cache
        return localStorageService.getItem(AUTH_TOKEN_STORAGE_KEY);

    };

    /**
     * Returns the identifier of the data source that authenticated the current
     * user. If the current user is not logged in, this value may not be valid.
     *
     * @returns {String}
     *     The identifier of the data source that authenticated the current
     *     user, or null if no authentication data is present.
     */
    service.getDataSource = function getDataSource() {

        // Return data source, if available
        var authData = getAuthenticationResult();
        if (authData)
            return authData.dataSource;

        // No auth data present
        return null;

    };

    /**
     * Returns the identifiers of all data sources available to the current
     * user. If the current user is not logged in, this value may not be valid.
     *
     * @returns {String[]}
     *     The identifiers of all data sources availble to the current user,
     *     or an empty array if no authentication data is present.
     */
    service.getAvailableDataSources = function getAvailableDataSources() {

        // Return data sources, if available
        var authData = getAuthenticationResult();
        if (authData)
            return authData.availableDataSources;

        // No auth data present
        return [];

    };

    /**
     * Makes an HTTP request leveraging the requestService(), automatically
     * including the given authentication token using the "Guacamole-Token"
     * header. If no token is provided, the user's current authentication token
     * is used instead. If the user is not logged in, the "Guacamole-Token"
     * header is simply omitted. The provided configuration object is not
     * modified by this function.
     *
     * @param {Object} object
     *     A configuration object describing the HTTP request to be made by
     *     requestService(). As described by requestService(), this object must
     *     be a configuration object accepted by AngularJS' $http service.
     *
     * @param {string} [token]
     *     The authentication token to pass with the "Guacamole-Token" header.
     *     If omitted, and the user is logged in, the user's current
     *     authentication token will be used.
     *
     * @returns {Promise.<Object>}
     *     A promise that will resolve with the data from the HTTP response for
     *     the underlying requestService() call if successful, or reject with
     *     an @link{Error} describing the failure.
     */
    service.request = function request(object, token) {

        // Attempt to use current token if none is provided
        token = token || service.getCurrentToken();

        // Add "Guacamole-Token" header if an authentication token is available
        if (token) {
            object = _.merge({
                headers : { 'Guacamole-Token' : token }
            }, object);
        }

        return requestService(object);

    };

    return service;
}]);
