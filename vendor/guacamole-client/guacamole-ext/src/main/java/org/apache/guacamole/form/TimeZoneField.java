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

package org.apache.guacamole.form;

/**
 * Represents a time zone field. The field may contain only valid time zone
 * identifiers, as defined by the IANA time zone database. Such identifiers are
 * also valid Java time zone IDs as dictated by TimeZone.getAvailableIDs().
 */
public class TimeZoneField extends Field {

    /**
     * Creates a new TimeZoneField with the given name.
     *
     * @param name
     *     The unique name to associate with this field.
     */
    public TimeZoneField(String name) {
        super(name, Field.Type.TIMEZONE);
    }

    /**
     * Parses the given string into a time zone ID string. As these strings are
     * equivalent, the only transformation currently performed by this function
     * is to ensure that a blank time zone string is parsed into null.
     *
     * @param timeZone
     *     The time zone string to parse, which may be null.
     *
     * @return
     *     The ID of the time zone corresponding to the given string, or null
     *     if the given time zone string was null or blank.
     */
    public static String parse(String timeZone) {

        // Return null if no time zone provided
        if (timeZone == null || timeZone.isEmpty())
            return null;

        // Otherwise, assume time zone is valid
        return timeZone;

    }

}
