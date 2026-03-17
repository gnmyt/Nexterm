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
 * Controller for time restriction fields, which are used to select weekday and
 * time restrictions that apply to user logins and connections.
 */
angular.module('guacRestrict').controller('timeRestrictionFieldController', ['$scope', '$injector',
        function timeRestrictionFieldController($scope, $injector) {
    
    // Required types
    const TimeRestrictionEntry = $injector.get('TimeRestrictionEntry');
    
    /**
     * Options which dictate the behavior of the input field model, as defined
     * by https://docs.angularjs.org/api/ng/directive/ngModelOptions
     *
     * @type Object.<String, String>
     */
    $scope.modelOptions = {
        
        /**
         * Space-delimited list of events on which the model will be updated.
         *
         * @type String
         */
        updateOn : 'blur'

    };
    
    /**
     * The restrictions, as objects, that are used by the HTML template to
     * present the restrictions to the user via the web interface.
     * 
     * @type TimeRestrictionEntry[]
     */
    $scope.restrictions = [];

    /**
     * Map of weekday identifier to display name. Note that Sunday occurs
     * twice - once for the 0-index and once for the 7 index.
     */
    $scope.weekDays = [
        { id : '1', day : 'Monday' },
        { id : '2', day : 'Tuesday' },
        { id : '3', day : 'Wednesday' },
        { id : '4', day : 'Thursday' },
        { id : '5', day : 'Friday' },
        { id : '6', day : 'Saturday' },
        { id : '7', day : 'Sunday' },
        { id : '*', day : 'All days' }
    ];
    
    /**
     * Remove the current entry from the list.
     * 
     * @param {TimeRestrictionEntry} entry
     *     A restriction entry.
     */
    $scope.removeEntry = function removeEntry(entry) {
        if (entry === null || entry.$$hashKey === '') {
            return;
        }
        for (let i = 0; i < $scope.restrictions.length; i++) {
            if ($scope.restrictions[i].$$hashKey === entry.$$hashKey) {
                $scope.restrictions.splice(i,1);
                return;
            }
        }
    };
    
    /**
     * Add an empty entry to the restriction list.
     */
    $scope.addEntry = function addEntry() {
        $scope.restrictions.push(new TimeRestrictionEntry());
    };
    

    /**
     * Parse the provided string into an array containing the objects that
     * represent each of entries that can then be displayed as a more
     * user-friendly field.
     * 
     * @param {String} restrString
     *     The string that contains the restrictions, un-parsed and as stored
     *     in the underlying field.
     *     
     * @returns {TimeRestrictionEntry[]}
     *     An array of objects that represents each of the entries as parsed
     *     out of the string field, and which can be interpreted by the
     *     AngularJS field for display.
     */
    const parseRestrictions = function parseRestrictions(restrString) {
        
        // Array to store the restrictions
        var restrictions = [];
        
        // Grab the current date so that we can accurately parse DST later
        var templateDate = new Date();
        
        // If the string is null or empty, just return an empty array
        if (restrString === null || restrString === "")
            return restrictions;
        
        // Set up the RegEx and split the string using the separator.
        const restrictionRegex = new RegExp('^([0-7*])(?::((?:[01][0-9]|2[0-3])[0-5][0-9])\-((?:[01][0-9]|2[0-3])[0-5][0-9]))$');
        var restrArray = restrString.split(";");

        // Loop through split string and process each item
        for (let i = 0; i < restrArray.length; i++) {
            
            // Test if our regex matches
            if (restrictionRegex.test(restrArray[i])) {
                var currArray = restrArray[i].match(restrictionRegex);
                let entry = new TimeRestrictionEntry();
                entry.startTime = new Date(Date.UTC(templateDate.getFullYear(),
                                                    templateDate.getMonth(),
                                                    templateDate.getDate(),
                                                    parseInt(currArray[2].slice(0,2)),
                                                    parseInt(currArray[2].slice(2))));
                entry.endTime = new Date(Date.UTC(templateDate.getFullYear(),
                                                  templateDate.getMonth(),
                                                  templateDate.getDate(),
                                                  parseInt(currArray[3].slice(0,2)),
                                                  parseInt(currArray[3].slice(2))));
                var origDay = currArray[1];
                
                if (currArray[1] === '*')
                    entry.weekDay = '' + currArray[1];
                
                else {
                    // If UTC day is greater than local day, we subtract a day,
                    // wrapping as required.
                    if (entry.startTime.getDay() < entry.startTime.getUTCDay()) {
                        if (origDay <= 0) 
                            entry.weekDay = '' + 6;
                        else
                            entry.weekDay = '' + (--origDay);

                    }

                    // If UTC day is less than local day, we add a day, 
                    // wrapping as required.
                    else if (entry.startTime.getDay() > entry.startTime.getUTCDay()) {
                        if (origDay >= 6)
                            entry.weekDay = '' + 0;
                        else
                            entry.weekDay = '' + (++origDay);
                    }

                    // Local day and UTC day are the same, adjust the display day
                    else
                        entry.weekDay = '' + origDay;

                }

                restrictions.push(entry);
            }
        }
        
        return restrictions;
        
    };
    
    /**
     * Since new Time fields in HTML get a default year of 1970, we need to
     * merge the hours and minutes from the time field into the current Date,
     * primarily so that Daylight Savings Time offsets are correct.
     * 
     * @param {Date} justTime
     *     The Date object produced by an HTML field that contains the hours
     *     and minutes we need.
     *     
     * @returns {Date}
     *     The Date object that merges the current calendar date with the
     *     hours and minutes from the HTML field.
     */
    const timeToCurrentDate = function timeToCurrentDate(justTime) {
        let dateAndTime = new Date();
        dateAndTime.setHours(justTime.getHours());
        dateAndTime.setMinutes(justTime.getMinutes());
        
        return dateAndTime;
    };
    
    /**
     * Parse the restrictions in the field into a string that can be stored
     * in an underlying module.
     * 
     * @param {TimeRestrictionEntry[]} restrictions
     *     The array of restrictions that will be converted to a string.
     * 
     * @returns {String}
     *     The string containing the restriction data that can be stored in e.g.
     *     a database.
     */
    const storeRestrictions = function storeRestrictions(restrictions) {
        
        // If there are no members of the array, just return an empty string.
        if (restrictions === null || restrictions.length < 1)
            return '';
        
        let restrString = '';
        for (let i = 0; i < restrictions.length; i++) {
            // If any of the properties are not defined, skip this one.
            if (!Object.hasOwn(restrictions[i], 'weekDay')
                    || restrictions[i].weekDay === null
                    || restrictions[i].weekDay === ''
                    || !Object.hasOwn(restrictions[i], 'startTime')
                    || restrictions[i].startTime === null
                    || !(restrictions[i].startTime instanceof Date)
                    || !Object.hasOwn(restrictions[i], 'endTime') 
                    || restrictions[i].endTime === null
                    || !(restrictions[i].endTime instanceof Date))
                continue;
            
            // If this is not the first item, then add a semi-colon separator
            if (restrString.length > 0)
                restrString += ';';
            
            // When these fields first gets a value, the default year is 1970
            // In order to avoid issues with Daylight Savings Time, we have to
            // work around this.
            if (restrictions[i].startTime instanceof Date && restrictions[i].startTime.getFullYear() === 1970)
                restrictions[i].startTime = timeToCurrentDate(restrictions[i].startTime);
            
            if (restrictions[i].endTime instanceof Date && restrictions[i].endTime.getFullYear() === 1970)
                restrictions[i].endTime = timeToCurrentDate(restrictions[i].endTime);
            
            // Process the start day, factoring in wrapping for local time to
            // UTC adjustments.
            let weekDay = restrictions[i].weekDay;
            const startDay = restrictions[i].startTime.getDay();
            const utcStartDay = restrictions[i].startTime.getUTCDay();
            
            // Local day is less than UTC day, so we add a day for storing,
            // wrapping around as required.
            if (weekDay !== '*' && startDay < utcStartDay) {
                if (weekDay >= 6)
                    weekDay = 0;
                else
                    weekDay++;
            }
            
            else if (weekDay !== '*' && startDay > utcStartDay) {
                if (weekDay <= 0)
                    weekDay = 6;
                else
                    weekDay--;
            }
            
            let currString = '' + weekDay.toString();
            currString += ':';
            
            // Retrieve startTime hours component and add it, adding leading zero if required.
            let startHours = restrictions[i].startTime.getUTCHours();
            if (startHours !== null && startHours < 10)
                currString += '0';
            currString += startHours.toString();

            // Retrieve startTime minutes component and add it, adding leading zero if required.
            let startMins = restrictions[i].startTime.getUTCMinutes();
            if (startMins !== null && startMins < 10)
                currString += '0';
            currString += startMins.toString();
            
            currString += '-';

            // Retrieve endTime hours component and add it, adding leading zero if required.
            let endHours = restrictions[i].endTime.getUTCHours();
            if (endHours !== null && endHours < 10)
                currString += '0';
            currString += endHours.toString();

            // Retrieve endTime minutes component and add it, adding leading zero if required.
            let endMins = restrictions[i].endTime.getUTCMinutes();
            if (endMins !== null && endMins < 10)
                currString += '0';
            currString += endMins.toString();
            
            // Add the newly-created string to the overall restriction string.
            restrString += currString;
        }

        return restrString;
        
    };
    
    // Update the field when the model changes.
    $scope.$watch('model', function modelChanged(model) {
        $scope.restrictions = parseRestrictions(model);
    });

    // Update string value in model when web form is changed
    $scope.$watch('restrictions', function restrictionsChanged(restrictions) {
        $scope.model = storeRestrictions(restrictions);
    }, true);
        
}]);