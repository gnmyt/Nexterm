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

import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Represents a time field. The field may contain only time values which
 * conform to a standard pattern, defined by TimeField.FORMAT.
 */
public class TimeField extends Field {

    /**
     * The time format used by time fields, compatible with SimpleDateFormat.
     */
    public static final String FORMAT = "HH:mm:ss";

    /**
     * Creates a new TimeField with the given name.
     *
     * @param name
     *     The unique name to associate with this field.
     */
    public TimeField(String name) {
        super(name, Field.Type.TIME);
    }

    /**
     * Parses the given string into a corresponding time. The string must
     * follow the standard format used by time fields, as defined by
     * FORMAT and as would be produced by format().
     *
     * @param timeString
     *     The time string to parse, which may be null.
     *
     * @return
     *     The time corresponding to the given time string, or null if the
     *     provided time string was null or blank.
     *
     * @throws ParseException
     *     If the given time string does not conform to the standard format
     *     used by time fields.
     */
    public static Date parse(String timeString)
            throws ParseException {

        // Return null if no time provided
        if (timeString == null || timeString.isEmpty())
            return null;

        // Parse time according to format
        DateFormat timeFormat = new SimpleDateFormat(TimeField.FORMAT);
        return timeFormat.parse(timeString);

    }

    /**
     * Converts the given time into a string which follows the format used by
     * time fields.
     *
     * @param time
     *     The time value to format, which may be null.
     *
     * @return
     *     The formatted time, or null if the provided time was null.
     */
    public static String format(Date time) {
        DateFormat timeFormat = new SimpleDateFormat(TimeField.FORMAT);
        return time == null ? null : timeFormat.format(time);
    }

}
