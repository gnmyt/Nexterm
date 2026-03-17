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
 * Provides the TimeRestrictionEntry class definition.
 */
angular.module('guacRestrict').factory('TimeRestrictionEntry', [
        function defineTimeRestrictionEntry() {

    /**
     * Creates a new TimeRestrictionEntry, initializing the properties of that
     * TimeRestrictionEntry with the corresponding properties of the given
     * template.
     *
     * @constructor
     * @param {TimeRestrictionEntry|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     TimeRestrictionEntry.
     */
    var TimeRestrictionEntry = function TimeRestrictionEntry(template) {

        // Use empty object by default
        template = template || {};
        
        /**
         * The numerical representation of the day of the week this restriction
         * applies to.
         *
         * @type {string}
         */
        this.weekDay = template.weekDay || '';
        
        /**
         * The hour and minute that this restriction starts, in 24-hour time,
         * and with no separator between the hour and minute.
         * 
         * @type Date
         */
        this.startTime = template.startTime;
        
        /**
         * The hour and minute that this restriction ends, in 24-hour time, and
         * with no separator between the hour and minute.
         * 
         * @type Date
         */
        this.endTime = template.endTime;

    };

    return TimeRestrictionEntry;

}]);
