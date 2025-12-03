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

import org.apache.guacamole.net.auth.permission.ObjectPermission;

/**
 * Object representation of an object-related Guacamole permission, as
 * represented in the database.
 */
public class ObjectPermissionModel extends PermissionModel<ObjectPermission.Type> {

    /**
     * The unique identifier of the object affected by this permission.
     */
    private String objectIdentifier;

    /**
     * Creates a new, empty object permission.
     */
    public ObjectPermissionModel() {
    }

    /**
     * Returns the unique identifier of the object affected by this permission.
     *
     * @return
     *     The unique identifier of the object affected by this permission.
     */
    public String getObjectIdentifier() {
        return objectIdentifier;
    }

    /**
     * Sets the unique identifier of the object affected by this permission.
     *
     * @param objectIdentifier 
     *     The unique identifier of the object affected by this permission.
     */
    public void setObjectIdentifier(String objectIdentifier) {
        this.objectIdentifier = objectIdentifier;
    }

}
