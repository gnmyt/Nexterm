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
 * Service which defines the FieldType class.
 */
angular.module('form').factory('FieldType', [function defineFieldType() {
            
    /**
     * The object used by the formService for describing field types.
     * 
     * @constructor
     * @param {FieldType|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     FieldType.
     */
    var FieldType = function FieldType(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The raw HTML of the template that should be injected into the DOM of
         * a form using this field type. If provided, this will be used instead
         * of templateUrl.
         *
         * @type String
         */
        this.template = template.template;

        /**
         * The URL of the template that should be injected into the DOM of a
         * form using this field type. This property will be ignored if a raw
         * HTML template is supplied via the template property.
         *
         * @type String
         */
        this.templateUrl = template.templateUrl;

        /**
         * The name of the AngularJS module defining the controller for this
         * field type. This is optional, as not all field types will need
         * controllers.
         *
         * @type String
         */
        this.module = template.module;

        /**
         * The name of the controller for this field type. This is optional, as
         * not all field types will need controllers. If a controller is
         * specified, it will receive the following properties on the scope:
         *
         * namespace:
         *     A String which defines the unique namespace associated the
         *     translation strings used by the form using a field of this type.
         *
         * field:
         *     The Field object that is being rendered, representing a field of
         *     this type.
         *
         * model:
         *     The current String value of the field, if any.
         *
         * @type String
         */
        this.controller = template.controller;

    };

    return FieldType;

}]);