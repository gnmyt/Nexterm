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

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.Collection;

/**
 * Represents an arbitrary field, such as an HTTP parameter, the parameter of a
 * remote desktop protocol, or an input field within a form. Fields are generic
 * and typed dynamically through a type string, with the semantics of the field
 * defined by the type string. The behavior of each field type is defined
 * either through the web application itself (see FormService.js) or through
 * extensions.
 */
@JsonInclude(value=Include.NON_NULL)
public class Field {

    /**
     * All types of fields which are available by default. Additional field
     * types may be defined by extensions by using a unique field type name and
     * registering that name with the form service within JavaScript.
     *
     * See FormService.js.
     */
    public static class Type {

        /**
         * A text field, accepting arbitrary values.
         */
        public static final String TEXT = "TEXT";

        /**
         * An email address field. This field type generally behaves
         * identically to arbitrary text fields, but has semantic differences.
         */
        public static final String EMAIL = "EMAIL";

        /**
         * A username field. This field type generally behaves identically to
         * arbitrary text fields, but has semantic differences.
         */
        public static final String USERNAME = "USERNAME";

        /**
         * A password field, whose value is sensitive and must be hidden.
         */
        public static final String PASSWORD = "PASSWORD";

        /**
         * A numeric field, whose value must contain only digits.
         */
        public static final String NUMERIC = "NUMERIC";

        /**
         * A boolean field, whose value is either blank or "true".
         */
        public static final String BOOLEAN = "BOOLEAN";

        /**
         * An enumerated field, whose legal values are fully enumerated by a
         * provided, finite list.
         */
        public static final String ENUM = "ENUM";

        /**
         * A text field that can span more than one line.
         */
        public static final String MULTILINE = "MULTILINE";

        /**
         * A time zone field whose legal values are only valid time zone IDs,
         * as dictated by Java within TimeZone.getAvailableIDs().
         */
        public static final String TIMEZONE = "TIMEZONE";

        /**
         * Field type which allows selection of languages. The languages
         * displayed are the set of languages supported by the Guacamole web
         * application. Legal values are valid language IDs, as dictated by
         * the filenames of Guacamole's available translations.
         */
        public static final String LANGUAGE = "LANGUAGE";

        /**
         * A date field whose legal values conform to the pattern "YYYY-MM-DD",
         * zero-padded.
         */
        public static final String DATE = "DATE";

        /**
         * A time field whose legal values conform to the pattern "HH:MM:SS",
         * zero-padded, 24-hour.
         */
        public static final String TIME = "TIME";

        /**
         * An HTTP query parameter which is expected to be embedded in the URL
         * given to a user.
         */
        public static final String QUERY_PARAMETER = "QUERY_PARAMETER";

        /**
         * A color scheme accepted by the Guacamole server terminal emulator
         * and protocols which leverage it.
         */
        public static final String TERMINAL_COLOR_SCHEME = "TERMINAL_COLOR_SCHEME";
        
        /**
         * A redirect field whose value is an encoded URL to which the user
         * will be redirected.
         */
        public static final String REDIRECT = "REDIRECT";

    }

    /**
     * The unique name that identifies this field.
     */
    private String name;

    /**
     * The type of this field.
     */
    private String type;

    /**
     * A collection of all legal values of this field.
     */
    private Collection<String> options;

    /**
     * Creates a new Parameter with no associated name or type.
     */
    public Field() {
    }

    /**
     * Creates a new Field with the given name  and type.
     *
     * @param name
     *     The unique name to associate with this field.
     *
     * @param type
     *     The type of this field.
     */
    public Field(String name, String type) {
        this.name  = name;
        this.type  = type;
    }

    /**
     * Creates a new Field with the given name, type, and possible values.
     *
     * @param name
     *     The unique name to associate with this field.
     *
     * @param type
     *     The type of this field.
     *
     * @param options
     *     A collection of all possible valid options for this field.
     */
    public Field(String name, String type, Collection<String> options) {
        this.name    = name;
        this.type    = type;
        this.options = options;
    }

    /**
     * Returns the unique name associated with this field.
     *
     * @return
     *     The unique name associated with this field.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the unique name associated with this field.
     *
     * @param name
     *     The unique name to assign to this field.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the type of this field.
     *
     * @return
     *     The type of this field.
     */
    public String getType() {
        return type;
    }

    /**
     * Sets the type of this field.
     *
     * @param type
     *     The type of this field.
     */
    public void setType(String type) {
        this.type = type;
    }

    /**
     * Returns a mutable collection of field options. Changes to this
     * collection directly affect the available options.
     *
     * @return
     *     A mutable collection of field options, or null if the field has no
     *     options.
     */
    public Collection<String> getOptions() {
        return options;
    }

    /**
     * Sets the options available as possible values of this field.
     *
     * @param options
     *     The options to associate with this field.
     */
    public void setOptions(Collection<String> options) {
        this.options = options;
    }

}
