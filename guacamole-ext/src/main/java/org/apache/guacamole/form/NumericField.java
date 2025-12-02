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
 * Represents a field which may contain only integer values.
 */
public class NumericField extends Field {

    /**
     * Creates a new NumericField with the given name.
     *
     * @param name
     *     The unique name to associate with this field.
     */
    public NumericField(String name) {
        super(name, Field.Type.NUMERIC);
    }

    /**
     * Formats the given integer in the format required by a numeric field.
     *
     * @param i
     *     The integer to format, which may be null.
     *
     * @return
     *     A string representation of the given integer, or null if the given
     *     integer was null.
     */
    public static String format(Integer i) {

        // Return null if no value provided
        if (i == null)
            return null;

        // Convert to string
        return i.toString();

    }

    /**
     * Parses the given string as an integer, where the given string is in the
     * format required by a numeric field.
     *
     * @param str
     *     The string to parse as an integer, which may be null.
     *
     * @return
     *     The integer representation of the given string, or null if the given
     *     string was null.
     *
     * @throws NumberFormatException
     *     If the given string is not in a parseable format.
     */
    public static Integer parse(String str) throws NumberFormatException {

        // Return null if no value provided
        if (str == null || str.isEmpty())
            return null;

        // Parse as integer
        return Integer.valueOf(str);

    }

}
