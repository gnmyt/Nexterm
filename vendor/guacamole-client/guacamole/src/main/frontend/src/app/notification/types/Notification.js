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
 * Provides the Notification class definition.
 */
angular.module('notification').factory('Notification', [function defineNotification() {

    /**
     * Creates a new Notification, initializing the properties of that
     * Notification with the corresponding properties of the given template.
     *
     * @constructor
     * @param {Notification|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     Notification.
     */
    var Notification = function Notification(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The CSS class to associate with the notification, if any.
         *
         * @type String
         */
        this.className = template.className;

        /**
         * The title of the notification.
         *
         * @type String
         */
        this.title = template.title;

        /**
         * The body text of the notification.
         *
         * @type TranslatableMessage
         */
        this.text = template.text;

        /**
         * The translation namespace of the translation strings that will
         * be generated for all fields within the notification. This namespace
         * is absolutely required if form fields will be included in the
         * notification.
         *
         * @type String
         */
        this.formNamespace = template.formNamespace;

        /**
         * Optional form content to display. This may be a form, an array of
         * forms, or a simple array of fields.
         *
         * @type Form[]|Form|Field[]|Field
         */
        this.forms = template.forms;

        /**
         * The object which will receive all field values. Each field value
         * will be assigned to the property of this object having the same
         * name.
         *
         * @type Object.<String, String>
         */
        this.formModel = template.model;

        /**
         * The function to invoke when the form is submitted, if form fields
         * are present within the notification.
         *
         * @type Function
         */
        this.formSubmitCallback = template.formSubmitCallback;

        /**
         * An array of all actions available to the user in response to this
         * notification.
         *
         * @type NotificationAction[]
         */
        this.actions = template.actions || [];

        /**
         * The current progress state of the ongoing action associated with this
         * notification.
         *
         * @type NotificationProgress
         */
        this.progress = template.progress;

        /**
         * The countdown and corresponding default action which applies to
         * this notification, if any.
         *
         * @type NotificationCountdown
         */
        this.countdown = template.countdown;

    };

    return Notification;

}]);
