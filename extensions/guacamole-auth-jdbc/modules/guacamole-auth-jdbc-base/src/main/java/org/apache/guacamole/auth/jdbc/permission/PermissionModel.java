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

package org.apache.guacamole.auth.jdbc.permission;

/**
 * Generic base permission model which grants a permission of a particular type
 * to a specific entity (user or user group).
 *
 * @param <PermissionType>
 *     The type of permissions allowed within this model.
 */
public abstract class PermissionModel<PermissionType> {

    /**
     * The database ID of the entity to whom this permission is granted.
     */
    private Integer entityID;

    /**
     * The type of action granted by this permission.
     */
    private PermissionType type;
    
    /**
     * Returns the database ID of the entity to whom this permission is
     * granted.
     * 
     * @return
     *     The database ID of the entity to whom this permission is granted.
     */
    public Integer getEntityID() {
        return entityID;
    }

    /**
     * Sets the database ID of the entity to whom this permission is granted.
     *
     * @param entityID
     *     The database ID of the entity to whom this permission is granted.
     */
    public void setEntityID(Integer entityID) {
        this.entityID = entityID;
    }

    /**
     * Returns the type of action granted by this permission.
     *
     * @return
     *     The type of action granted by this permission.
     */
    public PermissionType getType() {
        return type;
    }

    /**
     * Sets the type of action granted by this permission.
     *
     * @param type
     *     The type of action granted by this permission.
     */
    public void setType(PermissionType type) {
        this.type = type;
    }

}
