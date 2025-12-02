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
 * Service which defines the Form class.
 */
angular.module('rest').factory('Form', [function defineForm() {

    /**
     * The object returned by REST API calls when representing the data
     * associated with a form or set of configuration parameters.
     *
     * @constructor
     * @param {Form|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     Form.
     */
    var Form = function Form(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name which uniquely identifies this form, or null if this form
         * has no name.
         *
         * @type String
         */
        this.name = template.name;

        /**
         * All fields contained within this form.
         *
         * @type Field[]
         */
        this.fields = template.fields || [];

    };

    return Form;

}]);
