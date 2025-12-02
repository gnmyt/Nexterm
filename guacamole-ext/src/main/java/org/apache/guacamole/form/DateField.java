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
 * Represents a date field. The field may contain only date values which
 * conform to a standard pattern, defined by DateField.FORMAT.
 */
public class DateField extends Field {

    /**
     * The date format used by date fields, compatible with SimpleDateFormat.
     */
    public static final String FORMAT = "yyyy-MM-dd";

    /**
     * Creates a new DateField with the given name.
     *
     * @param name
     *     The unique name to associate with this field.
     */
    public DateField(String name) {
        super(name, Field.Type.DATE);
    }

    /**
     * Converts the given date into a string which follows the format used by
     * date fields.
     *
     * @param date
     *     The date value to format, which may be null.
     *
     * @return
     *     The formatted date, or null if the provided time was null.
     */
    public static String format(Date date) {
        DateFormat dateFormat = new SimpleDateFormat(DateField.FORMAT);
        return date == null ? null : dateFormat.format(date);
    }

    /**
     * Parses the given string into a corresponding date. The string must
     * follow the standard format used by date fields, as defined by FORMAT
     * and as would be produced by format().
     *
     * @param dateString
     *     The date string to parse, which may be null.
     *
     * @return
     *     The date corresponding to the given date string, or null if the
     *     provided date string was null or blank.
     *
     * @throws ParseException
     *     If the given date string does not conform to the standard format
     *     used by date fields.
     */
    public static Date parse(String dateString)
            throws ParseException {

        // Return null if no date provided
        if (dateString == null || dateString.isEmpty())
            return null;

        // Parse date according to format
        DateFormat dateFormat = new SimpleDateFormat(DateField.FORMAT);
        return dateFormat.parse(dateString);

    }

}
