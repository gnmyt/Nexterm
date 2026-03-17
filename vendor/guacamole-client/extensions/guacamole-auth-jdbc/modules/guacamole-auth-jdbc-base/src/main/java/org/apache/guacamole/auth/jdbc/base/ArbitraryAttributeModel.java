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

package org.apache.guacamole.auth.jdbc.base;

/**
 * A single attribute name/value pair belonging to a object which implements
 * the Attributes interface, such as a Connection or User. Attributes stored
 * as raw name/value pairs are the attributes which are given to the database
 * authentication extension for storage by other extensions. Attributes which
 * are directly supported by the database authentication extension have defined
 * columns and properties with proper types, constraints, etc.
 */
public class ArbitraryAttributeModel {

    /**
     * The name of the attribute.
     */
    private String name;

    /**
     * The value the attribute is set to.
     */
    private String value;

    /**
     * Creates a new ArbitraryAttributeModel with its name and value both set
     * to null.
     */
    public ArbitraryAttributeModel() {
    }

    /**
     * Creates a new ArbitraryAttributeModel with its name and value
     * initialized to the given values.
     *
     * @param name
     *     The name of the attribute.
     *
     * @param value
     *     The value the attribute is set to.
     */
    public ArbitraryAttributeModel(String name, String value) {
        this.name = name;
        this.value = value;
    }

    /**
     * Returns the name of this attribute.
     *
     * @return
     *     The name of this attribute.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of this attribute.
     *
     * @param name
     *     The name of this attribute.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the value of this attribute.
     *
     * @return
     *     The value of this attribute.
     */
    public String getValue() {
        return value;
    }

    /**
     * Sets the value of this attribute.
     *
     * @param value
     *     The value of this attribute.
     */
    public void setValue(String value) {
        this.value = value;
    }

}
