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

package org.apache.guacamole.token;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class for generating parameter token names.
 */
public class TokenName {

    /**
     * Pattern which matches logical groupings of words within a
     * string. This pattern is intended to match logical groupings
     * regardless of the naming convention used: "CamelCase",
     * "headlessCamelCase", "lowercase_with_underscores",
     * "lowercase-with-dashes" or even "aVery-INCONSISTENTMix_ofAllStyles".
     */
    private static final Pattern STRING_NAME_GROUPING = Pattern.compile(

        // "Camel" word groups
        "\\p{javaUpperCase}\\p{javaLowerCase}+"

        // Groups of digits
        + "|[0-9]+"

        // Groups of uppercase letters, excluding the uppercase letter
        // which begins a following "Camel" group
        + "|\\p{javaUpperCase}+(?!\\p{javaLowerCase})"

        // Groups of lowercase letters which match no other pattern
        + "|\\p{javaLowerCase}+"

        // Groups of word characters letters which match no other pattern
        + "|\\b\\w+\\b"

    );

    /**
     * This utility class should not be instantiated.
     */
    private TokenName() {}

    /**
     * Generates the name of the parameter token that should be populated with
     * the given string. The provided string will be automatically transformed
     * from "CamelCase", "headlessCamelCase", "lowercase_with_underscores",
     * and "mixes_ofBoth_Styles" to consistent "UPPERCASE_WITH_UNDERSCORES".
     * Each returned token name will be prefixed with the string value provided
     * in the prefix.  The value provided in prefix will be prepended to the
     * string, but will itself not be transformed.
     *
     * @param name
     *     The string to be used to generate the token name.
     * 
     * @param prefix
     *     The prefix to prepend to the generated token name.
     *
     * @return
     *     The name of the parameter token that should be populated with the
     *     given string.
     */
    public static String canonicalize(final String name, final String prefix) {

        // If even one logical word grouping cannot be found, default to
        // simply converting the string to uppercase and adding the
        // prefix
        Matcher groupMatcher = STRING_NAME_GROUPING.matcher(name);
        if (!groupMatcher.find())
            return prefix + name.toUpperCase();

        // Split the given name into logical word groups, separated by
        // underscores and converted to uppercase
        StringBuilder builder = new StringBuilder(prefix);
        builder.append(groupMatcher.group(0).toUpperCase());

        while (groupMatcher.find()) {
            builder.append("_");
            builder.append(groupMatcher.group(0).toUpperCase());
        }

        return builder.toString();

    }
    
    /**
     * Generate the name of a parameter token from the given string, with no
     * added prefix, such that the token name will simply be the transformed
     * version of the string. See
     * {@link #canonicalize(java.lang.String, java.lang.String)}
     * 
     * 
     * @param name
     *     The string to use to generate the token name.
     * 
     * @return 
     *     The name of the parameter token that should be populated with the
     *     given string.
     */
    public static String canonicalize(final String name) {
        return canonicalize(name, "");
    }

}
