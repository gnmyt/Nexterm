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
 * Service for displaying notifications and modal status dialogs.
 */
angular.module('notification').factory('guacNotification', ['$injector',
        function guacNotification($injector) {

    // Required services
    var $rootScope            = $injector.get('$rootScope');
    var requestService        = $injector.get('requestService');
    var sessionStorageFactory = $injector.get('sessionStorageFactory');

    var service = {};

    /**
     * Getter/setter which retrieves or sets the current status notification,
     * which may simply be false if no status is currently shown.
     * 
     * @type Function
     */
    var storedStatus = sessionStorageFactory.create(false);

    /**
     * An action to be provided along with the object sent to showStatus which
     * closes the currently-shown status dialog.
     *
     * @type NotificationAction
     */
    service.ACKNOWLEDGE_ACTION = {
        name        : 'APP.ACTION_ACKNOWLEDGE',
        callback    : function acknowledgeCallback() {
            service.showStatus(false);
        }
    };

    /**
     * Retrieves the current status notification, which may simply be false if
     * no status is currently shown.
     * 
     * @type Notification|Boolean
     */
    service.getStatus = function getStatus() {
        return storedStatus();
    };

    /**
     * Shows or hides the given notification as a modal status. If a status
     * notification is currently shown, no further statuses will be shown
     * until the current status is hidden.
     *
     * @param {Notification|Boolean|Object} status
     *     The status notification to show.
     *
     * @example
     * 
     * // To show a status message with actions
     * guacNotification.showStatus({
     *     'title'      : 'Disconnected',
     *     'text'       : {
     *         'key' : 'NAMESPACE.SOME_TRANSLATION_KEY'
     *     },
     *     'actions'    : [{
     *         'name'       : 'reconnect',
     *         'callback'   : function () {
     *             // Reconnection code goes here
     *         }
     *     }]
     * });
     * 
     * // To hide the status message
     * guacNotification.showStatus(false);
     */
    service.showStatus = function showStatus(status) {
        if (!storedStatus() || !status)
            storedStatus(status);
    };

    /**
     * Promise error callback which displays a modal notification for all
     * rejections due to REST errors. The message displayed to the user within
     * the notification is provided by the contents of the @link{Error} object
     * within the REST response. All other rejections, such as those due to
     * JavaScript errors, are logged to the browser console without displaying
     * any notification.
     *
     * @constant
     * @type Function
     */
    service.SHOW_REQUEST_ERROR = requestService.createErrorCallback(function showRequestError(error) {
        service.showStatus({
            className  : 'error',
            title      : 'APP.DIALOG_HEADER_ERROR',
            text       : error.translatableMessage,
            actions    : [ service.ACKNOWLEDGE_ACTION ]
        });
    });

    // Hide status upon navigation
    $rootScope.$on('$routeChangeSuccess', function() {
        service.showStatus(false);
    });

    return service;

}]);
