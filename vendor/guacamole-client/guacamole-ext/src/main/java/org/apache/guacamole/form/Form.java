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
import java.util.ArrayList;
import java.util.Collection;

/**
 * Information which describes logical set of fields.
 */
@JsonInclude(value=Include.NON_NULL)
public class Form {

    /**
     * The name of this form. The form name must identify the form uniquely
     * from other forms.
     */
    private String name;

    /**
     * All fields associated with this form.
     */
    private Collection<Field> fields;

    /**
     * Creates a new Form object with no associated fields. The name is left
     * unset as null. If no form name is provided, this form must not be used
     * in the same context as another unnamed form.
     */
    public Form() {
        fields = new ArrayList<Field>();
    }

    /**
     * Creates a new Form object having the given name and containing the given
     * fields.
     *
     * @param name
     *     A name which uniquely identifies this form.
     *
     * @param fields
     *     The fields to provided within the new Form.
     */
    public Form(String name, Collection<Field> fields) {
        this.name = name;
        this.fields = fields;
    }

    /**
     * Returns a mutable collection of the fields associated with this form.
     * Changes to this collection affect the fields exposed to the user.
     *
     * @return
     *     A mutable collection of fields.
     */
    public Collection<Field> getFields() {
        return fields;
    }

    /**
     * Sets the collection of fields associated with this form.
     *
     * @param fields
     *     The collection of fields to associate with this form.
     */
    public void setFields(Collection<Field> fields) {
        this.fields = fields;
    }

    /**
     * Returns the name of this form. Form names must uniquely identify each
     * form.
     *
     * @return
     *     The name of this form, or null if the form has no name.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of this form. Form names must uniquely identify each form.
     *
     * @param name
     *     The name to assign to this form.
     */
    public void setName(String name) {
        this.name = name;
    }

}
