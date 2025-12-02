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
 * Service which defines the TranslatableMessage class.
 */
angular.module('rest').factory('TranslatableMessage', [function defineTranslatableMessage() {

    /**
     * The object returned by REST API calls when representing a message which
     * can be translated using the translation service, providing a translation
     * key and optional set of values to be substituted into the translation
     * string associated with that key.
     *
     * @constructor
     * @param {TranslatableMessage|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     TranslatableMessage.
     */
    var TranslatableMessage = function TranslatableMessage(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The key associated with the translation string that used when
         * displaying this message.
         *
         * @type String
         */
        this.key = template.key;

        /**
         * The object which should be passed through to the translation service
         * for the sake of variable substitution. Each property of the provided
         * object will be substituted for the variable of the same name within
         * the translation string.
         *
         * @type Object
         */
        this.variables = template.variables;

    };

    return TranslatableMessage;

}]);