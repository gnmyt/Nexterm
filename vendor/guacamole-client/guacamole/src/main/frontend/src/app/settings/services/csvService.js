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
 * A service for generating downloadable CSV links given arbitrary data.
 */
angular.module('settings').factory('csvService', [function csvService() {

    var service = {};

    /**
     * Encodes an arbitrary value for inclusion in a CSV file as an individual
     * field. With the exception of null and undefined (which are both
     * interpreted as equivalent to an empty string), all values are coerced to
     * a string and, if non-numeric, included within double quotes. If the
     * value itself includes double quotes, those quotes will be properly
     * escaped.
     *
     * @param {*} field
     *     The arbitrary value to encode.
     *
     * @return {String}
     *     The provided value, coerced to a string and properly escaped for
     *     CSV.
     */
    var encodeField = function encodeField(field) {

        // Coerce field to string
        if (field === null || field === undefined)
            field = '';
        else
            field = '' + field;

        // Do not quote numeric fields
        if (/^[0-9.]*$/.test(field))
            return field;

        // Enclose all other fields in quotes, escaping any quotes therein
        return '"' + field.replace(/"/g, '""') + '"';

    };

    /**
     * Encodes each of the provided values for inclusion in a CSV file as
     * fields within the same record (in the manner specified by
     * encodeField()), separated by commas.
     *
     * @param {*[]} fields
     *     An array of arbitrary values which make up the record.
     *
     * @return {String}
     *     A CSV record containing the each value in the given array.
     */
    var encodeRecord = function encodeRecord(fields) {
        return fields.map(encodeField).join(',');
    };

    /**
     * Encodes an entire array of records as properly-formatted CSV, where each
     * entry in the provided array is an array of arbitrary fields.
     *
     * @param {Array.<*[]>} records
     *     An array of all records making up the desired CSV.
     *
     * @return {String}
     *     An entire CSV containing each provided record, separated by CR+LF
     *     line terminators.
     */
    var encodeCSV = function encodeCSV(records) {
        return records.map(encodeRecord).join('\r\n');
    };

    /**
     * Creates a new Blob containing properly-formatted CSV generated from the
     * given array of records, where each entry in the provided array is an
     * array of arbitrary fields.
     *
     * @param {Array.<*[]>} records
     *     An array of all records making up the desired CSV.
     *
     * @returns {Blob}
     *     A new Blob containing each provided record in CSV format.
     */
    service.toBlob = function toBlob(records) {
        return new Blob([ encodeCSV(records) ], { type : 'text/csv' });
    };

    return service;

}]);
