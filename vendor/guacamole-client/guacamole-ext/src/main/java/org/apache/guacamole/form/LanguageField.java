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
 * Represents a language field. The field may contain only valid language
 * identifiers as used by the Guacamole web application for its translations.
 * Language identifiers are defined by the filenames of the JSON files
 * containing the translation.
 */
public class LanguageField extends Field {

    /**
     * Creates a new LanguageField with the given name.
     *
     * @param name
     *     The unique name to associate with this field.
     */
    public LanguageField(String name) {
        super(name, Field.Type.LANGUAGE);
    }

    /**
     * Parses the given string into a language ID string. As any string may be
     * a valid language ID as long as it has a corresponding translation, the
     * only transformation currently performed by this function is to ensure
     * that a blank language string is parsed into null.
     *
     * @param language
     *     The language string to parse, which may be null.
     *
     * @return
     *     The ID of the language corresponding to the given string, or null if
     *     if the given language string was null or blank.
     */
    public static String parse(String language) {

        // Return null if no language is provided
        if (language == null || language.isEmpty())
            return null;

        // Otherwise, assume language is already a valid language ID
        return language;

    }

}
