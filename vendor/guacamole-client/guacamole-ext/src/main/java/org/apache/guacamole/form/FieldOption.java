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

/**
 * Describes an available legal value for an enumerated field.
 */
@JsonInclude(value=Include.NON_NULL)
public class FieldOption {

    /**
     * The value that will be assigned if this option is chosen.
     */
    private String value;

    /**
     * A human-readable title describing the effect of the value.
     */
    private String title;

    /**
     * Creates a new FieldOption with no associated value or title.
     */
    public FieldOption() {
    }

    /**
     * Creates a new FieldOption having the given value and title.
     *
     * @param value
     *     The value to assign if this option is chosen.
     *
     * @param title
     *     The human-readable title to associate with this option.
     */
    public FieldOption(String value, String title) {
        this.value = value;
        this.title = title;
    }

    /**
     * Returns the value that will be assigned if this option is chosen.
     *
     * @return
     *     The value that will be assigned if this option is chosen.
     */
    public String getValue() {
        return value;
    }

    /**
     * Sets the value that will be assigned if this option is chosen.
     *
     * @param value
     *     The value to assign if this option is chosen.
     */
    public void setValue(String value) {
        this.value = value;
    }

    /**
     * Returns the human-readable title describing the effect of this option.
     *
     * @return
     *     The human-readable title describing the effect of this option.
     */
    public String getTitle() {
        return title;
    }

    /**
     * Sets the human-readable title describing the effect of this option.
     *
     * @param title
     *     A human-readable title describing the effect of this option.
     */
    public void setTitle(String title) {
        this.title = title;
    }

}
