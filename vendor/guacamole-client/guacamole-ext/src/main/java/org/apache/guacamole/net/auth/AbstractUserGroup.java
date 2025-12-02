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
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * Base implementation of UserGroup which provides default implementations of
 * most functions.
 */
public abstract class AbstractUserGroup extends AbstractIdentifiable implements UserGroup {

    /**
     * Creates a new AbstractUserGroup that considers group names to be
     * case-sensitive or case-insensitive based on the provided case
     * sensitivity flag.
     *
     * @param caseSensitive
     *     true if group names should be considered case-sensitive, false
     *     otherwise.
     */
    public AbstractUserGroup(boolean caseSensitive) {
        super(caseSensitive);
    }

    /**
     * Creates a new AbstractUserGroup that considers group names to be
     * case-sensitive or case-insensitive based on the case sensitivity setting
     * of the provided {@link Environment}, as returned by
     * {@link Environment#getCaseSensitivity()}.
     *
     * @param environment
     *     The Environment that should determine whether this AbstractUserGroup
     *     considers group names to be case-sensitive.
     */
    public AbstractUserGroup(Environment environment) {
        this(environment.getCaseSensitivity().caseSensitiveGroupNames());
    }

    /**
     * Creates a new AbstractUserGroup that considers group names to be
     * case-sensitive or case-insensitive based on the case sensitivity setting
     * of an instance of {@link LocalEnvironment}, as returned by
     * {@link LocalEnvironment#getCaseSensitivity()}.
     */
    public AbstractUserGroup() {
        this(LocalEnvironment.getInstance());
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
     * <p>This implementation simply an immutable, empty related object set.
     * Implementations that wish to expose group membership should override
     * this function.
     */
    @Override
    public RelatedObjectSet getMemberUsers() throws GuacamoleException {
        return RelatedObjectSet.EMPTY_SET;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply an immutable, empty related object set.
     * Implementations that wish to expose group membership should override
     * this function.
     */
    @Override
    public RelatedObjectSet getMemberUserGroups() throws GuacamoleException {
        return RelatedObjectSet.EMPTY_SET;
    }

}
