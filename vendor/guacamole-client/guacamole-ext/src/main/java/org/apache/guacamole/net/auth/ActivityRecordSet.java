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

package org.apache.guacamole.net.auth;

import java.util.Collection;
import org.apache.guacamole.GuacamoleException;

/**
 * A set of all available records related to a type of activity which has a
 * defined start and end time, such as a user being logged in or connected, or a
 * subset of those records.
 *
 * @param <RecordType>
 *     The type of ActivityRecord contained within this set.
 */
public interface ActivityRecordSet<RecordType extends ActivityRecord> {

    /**
     * All properties of activity records which can be used as sorting
     * criteria.
     */
    enum SortableProperty {

        /**
         * The date and time when the activity associated with the record
         * began.
         */
        START_DATE

    };

    /**
     * Returns all records within this set as a standard Collection.
     *
     * @return
     *      A collection containing all records within this set.
     *
     * @throws GuacamoleException
     *      If an error occurs while retrieving the records within this set.
     */
    Collection<RecordType> asCollection() throws GuacamoleException;

    /**
     * Returns the record having the given unique identifier, if records within
     * this set have unique identifiers. If records within this set do not have
     * defined unique identifiers, this function has no effect.
     *
     * @param identifier
     *     The unique identifier of the record to retrieve.
     *
     * @return
     *     The record having the given unique identifier, or null if there is
     *     no such record.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the record.
     */
    default RecordType get(String identifier) throws GuacamoleException {
        return asCollection().stream()
                .filter((record) -> {
                    String recordIdentifier = record.getIdentifier();
                    return recordIdentifier != null && recordIdentifier.equals(identifier);
                })
                .findFirst().orElse(null);
    }

    /**
     * Returns the subset of records which contain the given value. The
     * properties and semantics involved with determining whether a particular
     * record "contains" the given value is implementation dependent. This
     * function may affect the contents of the current ActivityRecordSet. The
     * contents of the current ActivityRecordSet should NOT be relied upon
     * after this function is called.
     *
     * @param value
     *     The value which all records within the resulting subset should
     *     contain.
     *
     * @return
     *     The subset of records which contain the specified value.
     *
     * @throws GuacamoleException
     *     If an error occurs while restricting the current subset.
     */
    ActivityRecordSet<RecordType> contains(String value)
            throws GuacamoleException;

    /**
     * Returns the subset of records containing only the first
     * <code>limit</code> records. If the subset has fewer than
     * <code>limit</code> records, then this function has no effect. This
     * function may also affect the contents of the current ActivityRecordSet.
     * The contents of the current ActivityRecordSet should NOT be relied upon
     * after this function is called.
     *
     * @param limit
     *     The maximum number of records that the new subset should contain.
     *
     * @return
     *     The subset of records that containing only the first
     *     <code>limit</code> records.
     *
     * @throws GuacamoleException
     *     If an error occurs while limiting the current subset.
     */
    ActivityRecordSet<RecordType> limit(int limit) throws GuacamoleException;

    /**
     * Returns a ActivityRecordSet containing identically the records within
     * this set, sorted according to the specified criteria. The sort operation
     * performed is guaranteed to be stable with respect to any past call to
     * sort(). This function may also affect the contents of the current
     * ActivityRecordSet. The contents of the current ActivityRecordSet
     * should NOT be relied upon after this function is called.
     *
     * @param property
     *     The property by which the records within the resulting set should be
     *     sorted.
     *
     * @param desc
     *     Whether the records should be sorted according to the specified
     *     property in descending order. If false, records will be sorted
     *     according to the specified property in ascending order.
     *
     * @return
     *     The ActivityRecordSet, sorted according to the specified criteria.
     *
     * @throws GuacamoleException
     *     If an error occurs while sorting the current subset, or if the given
     *     property is not supported by the implementation.
     */
    ActivityRecordSet<RecordType> sort(SortableProperty property, boolean desc)
            throws GuacamoleException;

}
