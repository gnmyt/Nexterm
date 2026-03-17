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

package org.apache.guacamole.net.auth;

import java.util.Collections;
import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * Base implementation of User which provides default implementations of
 * most functions.
 */
public abstract class AbstractUser extends AbstractIdentifiable
        implements User {

    /**
     * This user's password. Note that while this provides a means for the
     * password to be set, the data stored in this String is not necessarily
     * the user's actual password. It may be hashed, it may be arbitrary.
     */
    private String password;

    /**
     * Creates a new AbstractUser that considers usernames to be case-sensitive
     * or case-insensitive based on the provided case sensitivity flag.
     *
     * @param caseSensitive
     *     true if usernames should be considered case-sensitive, false
     *     otherwise.
     */
    public AbstractUser(boolean caseSensitive) {
        super(caseSensitive);
    }

    /**
     * Creates a new AbstractUser that considers usernames to be case-sensitive
     * or case-insensitive based on the case sensitivity setting of the provided
     * {@link Environment}, as returned by {@link Environment#getCaseSensitivity()}.
     *
     * @param environment
     *     The Environment that should determine whether this AbstractUser
     *     considers usernames to be case-sensitive.
     */
    public AbstractUser(Environment environment) {
        this(environment.getCaseSensitivity().caseSensitiveUsernames());
    }

    /**
     * Creates a new AbstractUser that considers usernames to be case-sensitive
     * or case-insensitive based on the case sensitivity setting of an instance
     * of {@link LocalEnvironment}, as returned by @link LocalEnvironment#getCaseSensitivity()}.
     */
    public AbstractUser() {
        this(LocalEnvironment.getInstance());
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public void setPassword(String password) {
        this.password = password;
    }
    
    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty map. Implementations
     * that wish to expose custom attributes should override this function.
     */
    @Override
    public Map<String, String> getAttributes() {
        return Collections.emptyMap();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply ignores all attributes given.
     * Implementations that wish to support modification of custom attributes
     * should override this function.
     */
    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Ignore all attributes by default
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns {@code null}. Implementations that
     * wish to expose the date and time that a user was last active should
     * override this function.
     */
    @Override
    public Date getLastActive() {
        return null;
    }
    
    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public SystemPermissionSet getSystemPermissions()
            throws GuacamoleException {
        return SystemPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getUserPermissions()
            throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getUserGroupPermissions()
            throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty permission set.
     * Implementations that wish to expose permissions should override this
     * function.
     */
    @Override
    public ObjectPermissionSet getSharingProfilePermissions() {
        return ObjectPermissionSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty related object set.
     * Implementations that wish to expose group membership should override
     * this function.
     */
    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        return RelatedObjectSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns {@code this}. Implementations that
     * wish to expose permissions which apply indirectly (such as through
     * group inheritance) should override this function.
     */
    @Override
    public Permissions getEffectivePermissions() throws GuacamoleException {
        return this;
    }

}
