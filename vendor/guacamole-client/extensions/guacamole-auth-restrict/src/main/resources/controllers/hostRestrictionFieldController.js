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
 * Controller for host restriction fields, which are used to configure a
 * hostname, IP address, or CIDR range, that this restriction applies to.
 */
angular.module('guacRestrict').controller('hostRestrictionFieldController', ['$scope', '$injector',
    function hostRestrictionFieldController($scope, $injector) {
       
    // Required types
    const HostRestrictionEntry = $injector.get('HostRestrictionEntry');
        
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
        updateOn : 'blur',

        /**
         * The time zone to use when reading/writing the Date object of the
         * model.
         *
         * @type String
         */
        timezone : 'UTC'

    };
    
    /**
     * The restrictions, as objects, that are used by the HTML template to
     * present the restrictions to the user via the web interface.
     * 
     * @type HostRestrictionEntry[]
     */
    $scope.restrictions = [];
    
    /**
     * Remove the current entry from the list.
     * 
     * @param {HostRestrictionEntry} entry
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
        $scope.restrictions.push(new HostRestrictionEntry());
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
     * @returns {HostRestrictionEntry[]}
     *     An array of objects that represents each of the entries as parsed
     *     out of the string field, and which can be interpreted by the
     *     AngularJS field for display.
     */
    const parseRestrictions = function parseRestrictions(restrString) {
        
        var restrictions = [];
        
        // If the string is null or empty, just return an empty array
        if (restrString === null || restrString === "")
            return restrictions;
        
        // Set up the RegEx and split the string using the separator.
        var restrArray = restrString.split(";");
        
        // Loop through split string and process each item
        for (let i = 0; i < restrArray.length; i++) {
            var entry = new HostRestrictionEntry();
            entry.host = restrArray[i];
            restrictions.push(entry);
        }
        
        return restrictions;
        
    };
    
    /**
     * Parse the restrictions in the field into a string that can be stored
     * in an underlying module.
     * 
     * @param {HostRestrictionEntry[]} restrictions
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
        
        var restrString = '';
        for (let i = 0; i < restrictions.length; i++) {
            // If any of the properties are not defined, skip this one.
            if (!Object.hasOwn(restrictions[i], 'host')
                    || restrictions[i].host === null)
                continue;
            
            // If this is not the first item, then add a semi-colon separator
            if (restrString.length > 0)
                restrString += ';';
            
            // Add the current host to the list
            restrString += restrictions[i].host;
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