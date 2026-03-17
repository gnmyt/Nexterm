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
 * Object representation of a Guacamole object which can be the child of another
 * object, such as a connection or sharing profile, as represented in the
 * database.
 */
public abstract class ChildObjectModel extends ObjectModel {

    /**
     * The unique identifier which identifies the parent of this object.
     */
    private String parentIdentifier;
    
    /**
     * Creates a new, empty object.
     */
    public ChildObjectModel() {
    }

    /**
     * Returns the identifier of the parent connection group, or null if the
     * parent connection group is the root connection group.
     *
     * @return 
     *     The identifier of the parent connection group, or null if the parent
     *     connection group is the root connection group.
     */
    public String getParentIdentifier() {
        return parentIdentifier;
    }

    /**
     * Sets the identifier of the parent connection group.
     *
     * @param parentIdentifier
     *     The identifier of the parent connection group, or null if the parent
     *     connection group is the root connection group.
     */
    public void setParentIdentifier(String parentIdentifier) {
        this.parentIdentifier = parentIdentifier;
    }

}
