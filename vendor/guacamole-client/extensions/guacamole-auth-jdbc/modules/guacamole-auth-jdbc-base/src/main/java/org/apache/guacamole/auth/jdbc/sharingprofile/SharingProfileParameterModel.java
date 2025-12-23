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

package org.apache.guacamole.auth.jdbc.sharingprofile;

/**
 * A single parameter name/value pair belonging to a sharing profile.
 */
public class SharingProfileParameterModel {

    /**
     * The identifier of the sharing profile associated with this parameter.
     */
    private String sharingProfileIdentifier;

    /**
     * The name of the parameter.
     */
    private String name;

    /**
     * The value the parameter is set to.
     */
    private String value;

    /**
     * Returns the identifier of the sharing profile associated with this
     * parameter.
     *
     * @return
     *     The identifier of the sharing profile associated with this
     *     parameter.
     */
    public String getSharingProfileIdentifier() {
        return sharingProfileIdentifier;
    }

    /**
     * Sets the identifier of the sharing profile associated with this
     * parameter.
     *
     * @param sharingProfileIdentifier
     *     The identifier of the sharing profile to associate with this
     *     parameter.
     */
    public void setSharingProfileIdentifier(String sharingProfileIdentifier) {
        this.sharingProfileIdentifier = sharingProfileIdentifier;
    }

    /**
     * Returns the name of this parameter.
     *
     * @return
     *     The name of this parameter.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of this parameter.
     *
     * @param name
     *     The name of this parameter.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the value of this parameter.
     *
     * @return
     *     The value of this parameter.
     */
    public String getValue() {
        return value;
    }

    /**
     * Sets the value of this parameter.
     *
     * @param value
     *     The value of this parameter.
     */
    public void setValue(String value) {
        this.value = value;
    }

}
