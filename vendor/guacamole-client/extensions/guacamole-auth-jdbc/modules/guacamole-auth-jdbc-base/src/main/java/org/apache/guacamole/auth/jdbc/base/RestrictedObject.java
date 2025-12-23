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

import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;

/**
 * Common base class for objects that are associated with the users that
 * obtain them.
 */
public abstract class RestrictedObject {

    /**
     * The user this object belongs to. Access is based on his/her permission
     * settings.
     */
    private ModeledAuthenticatedUser currentUser;

    /**
     * Initializes this object, associating it with the current authenticated
     * user and populating it with data from the given model object
     *
     * @param currentUser
     *     The user that created or retrieved this object.
     */
    public void init(ModeledAuthenticatedUser currentUser) {
        setCurrentUser(currentUser);
    }

    /**
     * Returns the user that created or queried this object. This user's
     * permissions dictate what operations can be performed on or through this
     * object.
     *
     * @return
     *     The user that created or queried this object.
     */
    public ModeledAuthenticatedUser getCurrentUser() {
        return currentUser;
    }

    /**
     * Sets the user that created or queried this object. This user's
     * permissions dictate what operations can be performed on or through this
     * object.
     *
     * @param currentUser 
     *     The user that created or queried this object.
     */
    public void setCurrentUser(ModeledAuthenticatedUser currentUser) {
        this.currentUser = currentUser;
    }

}
