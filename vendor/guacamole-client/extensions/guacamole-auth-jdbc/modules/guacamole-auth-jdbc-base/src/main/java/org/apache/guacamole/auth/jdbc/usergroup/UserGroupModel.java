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

package org.apache.guacamole.auth.jdbc.usergroup;

import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.EntityType;

/**
 * Object representation of a Guacamole user group, as represented in the
 * database.
 */
public class UserGroupModel extends EntityModel {

    /**
     * Whether the user group is disabled. Disabled accounts exist and can
     * be modified, but cannot be used.
     */
    private boolean disabled;

    /**
     * Creates a new, empty user group.
     */
    public UserGroupModel() {
        super(EntityType.USER_GROUP);
    }

    /**
     * Returns whether this user group has been disabled. Memberships of
     * disabled user groups are treated as non-existent, effectively disabling
     * membership in that group.
     *
     * @return
     *     true if this user group is disabled, false otherwise.
     */
    public boolean isDisabled() {
        return disabled;
    }

    /**
     * Sets whether this user group has been disabled. Memberships of disabled
     * user groups are treated as non-existent, effectively disabling
     * membership in that group.
     *
     * @param disabled
     *     true if this user group should be disabled, false otherwise.
     */
    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
    }

}
