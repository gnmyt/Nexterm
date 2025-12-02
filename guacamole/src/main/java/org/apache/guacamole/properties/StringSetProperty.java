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

package org.apache.guacamole.properties;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.properties.GuacamoleProperty;

/**
 * A GuacamoleProperty whose value is a Set of unique Strings. The string value
 * parsed to produce this set is a comma-delimited list. Duplicate values are
 * ignored, as is any whitespace following delimiters. To maintain
 * compatibility with the behavior of Java properties in general, only
 * whitespace at the beginning of each value is ignored; trailing whitespace
 * becomes part of the value.
 */
public abstract class StringSetProperty implements GuacamoleProperty<Set<String>> {

    /**
     * A pattern which matches against the delimiters between values. This is
     * currently simply a comma and any following whitespace. Parts of the
     * input string which match this pattern will not be included in the parsed
     * result.
     */
    private static final Pattern DELIMITER_PATTERN = Pattern.compile(",\\s*");

    @Override
    public Set<String> parseValue(String values) throws GuacamoleException {

        // If no property provided, return null.
        if (values == null)
            return null;

        // Split string into a set of individual values
        List<String> valueList = Arrays.asList(DELIMITER_PATTERN.split(values));
        return new HashSet<String>(valueList);

    }

}
