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
 * Service which defines the Field class.
 */
angular.module('rest').factory('Field', [function defineField() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with a field or configuration parameter.
     * 
     * @constructor
     * @param {Field|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     Field.
     */
    var Field = function Field(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name which uniquely identifies this parameter.
         *
         * @type String
         */
        this.name = template.name;

        /**
         * The type string defining which values this parameter may contain,
         * as well as what properties are applicable. Valid types are listed
         * within Field.Type.
         *
         * @type String
         * @default Field.Type.TEXT
         */
        this.type = template.type || Field.Type.TEXT;

        /**
         * All possible legal values for this parameter.
         *
         * @type String[]
         */
        this.options = template.options;

    };

    /**
     * All valid field types.
     */
    Field.Type = {

        /**
         * The type string associated with parameters that may contain a single
         * line of arbitrary text.
         *
         * @type String
         */
        TEXT : 'TEXT',

        /**
         * The type string associated with parameters that may contain an email
         * address.
         *
         * @type String
         */
        EMAIL : 'EMAIL',

        /**
         * The type string associated with parameters that may contain an
         * arbitrary string, where that string represents the username of the
         * user authenticating with the remote desktop service.
         * 
         * @type String
         */
        USERNAME : 'USERNAME',

        /**
         * The type string associated with parameters that may contain an
         * arbitrary string, where that string represents the password of the
         * user authenticating with the remote desktop service.
         * 
         * @type String
         */
        PASSWORD : 'PASSWORD',

        /**
         * The type string associated with parameters that may contain only
         * numeric values.
         * 
         * @type String
         */
        NUMERIC : 'NUMERIC',

        /**
         * The type string associated with parameters that may contain only a
         * single possible value, where that value enables the parameter's
         * effect. It is assumed that each BOOLEAN field will provide exactly
         * one possible value (option), which will be the value if that field
         * is true.
         * 
         * @type String
         */
        BOOLEAN : 'BOOLEAN',

        /**
         * The type string associated with parameters that may contain a
         * strictly-defined set of possible values.
         * 
         * @type String
         */
        ENUM : 'ENUM',

        /**
         * The type string associated with parameters that may contain any
         * number of lines of arbitrary text.
         *
         * @type String
         */
        MULTILINE : 'MULTILINE',

        /**
         * The type string associated with parameters that may contain timezone
         * IDs. Valid timezone IDs are dictated by Java:
         * http://docs.oracle.com/javase/7/docs/api/java/util/TimeZone.html#getAvailableIDs%28%29
         *
         * @type String
         */
        TIMEZONE : 'TIMEZONE',

        /**
         * The type string associated with parameters that may contain dates.
         * The format of the date is standardized as YYYY-MM-DD, zero-padded.
         *
         * @type String
         */
        DATE : 'DATE',

        /**
         * The type string associated with parameters that may contain times.
         * The format of the time is stnadardized as HH:MM:DD, zero-padded,
         * 24-hour.
         *
         * @type String
         */
        TIME : 'TIME',

        /**
         * An HTTP query parameter which is expected to be embedded in the URL
         * given to a user.
         *
         * @type String
         */
        QUERY_PARAMETER : 'QUERY_PARAMETER',

        /**
         * The type string associated with parameters that may contain color
         * schemes accepted by the Guacamole server terminal emulator and
         * protocols which leverage it.
         *
         * @type String
         */
        TERMINAL_COLOR_SCHEME : 'TERMINAL_COLOR_SCHEME'

    };

    return Field;

}]);