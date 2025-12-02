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

package org.apache.guacamole.rest.history;

import javax.ws.rs.core.Response;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.rest.APIException;

/**
 * A sort predicate which species the property to use when sorting activity
 * records, along with the sort order.
 */
public class APISortPredicate {

    /**
     * The prefix which will be included before the name of a sortable property
     * to indicate that the sort order is descending, not ascending.
     */
    public static final String DESCENDING_PREFIX = "-";

    /**
     * All possible property name strings and their corresponding
     * ActivityRecordSet.SortableProperty values.
     */
    public enum SortableProperty {

        /**
         * The date that the activity associated with the activity record
         * began.
         */
        startDate(ActivityRecordSet.SortableProperty.START_DATE);

        /**
         * The ActivityRecordSet.SortableProperty that this property name
         * string represents.
         */
        public final ActivityRecordSet.SortableProperty recordProperty;

        /**
         * Creates a new SortableProperty which associates the property name
         * string (identical to its own name) with the given
         * ActivityRecordSet.SortableProperty value.
         *
         * @param recordProperty
         *     The ActivityRecordSet.SortableProperty value to associate with
         *     the new SortableProperty.
         */
        SortableProperty(ActivityRecordSet.SortableProperty recordProperty) {
            this.recordProperty = recordProperty;
        }

    }

    /**
     * The property to use when sorting ActivityRecords.
     */
    private ActivityRecordSet.SortableProperty property;

    /**
     * Whether the requested sort order is descending (true) or ascending
     * (false).
     */
    private boolean descending;

    /**
     * Parses the given string value, determining the requested sort property
     * and ordering. Possible values consist of any valid property name, and
     * may include an optional prefix to denote descending sort order. Each
     * possible property name is enumerated by the SortableValue enum.
     *
     * @param value
     *     The sort predicate string to parse, which must consist ONLY of a
     *     valid property name, possibly preceded by the DESCENDING_PREFIX.
     *
     * @throws APIException
     *     If the provided sort predicate string is invalid.
     */
    public APISortPredicate(String value)
        throws APIException {

        // Parse whether sort order is descending
        if (value.startsWith(DESCENDING_PREFIX)) {
            descending = true;
            value = value.substring(DESCENDING_PREFIX.length());
        }

        // Parse sorting property into ActivityRecordSet.SortableProperty
        try {
            this.property = SortableProperty.valueOf(value).recordProperty;
        }

        // Bail out if sort property is not valid
        catch (IllegalArgumentException e) {
            throw new APIException(new GuacamoleClientException(String.format("Invalid sort property: \"%s\"", value)));
        }

    }

    /**
     * Returns the SortableProperty defined by ActivityRecordSet which
     * represents the property requested.
     *
     * @return
     *     The ActivityRecordSet.SortableProperty which refers to the same
     *     property as the string originally provided when this
     *     APISortPredicate was created.
     */
    public ActivityRecordSet.SortableProperty getProperty() {
        return property;
    }

    /**
     * Returns whether the requested sort order is descending.
     *
     * @return
     *     true if the sort order is descending, false if the sort order is
     *     ascending.
     */
    public boolean isDescending() {
        return descending;
    }

}
