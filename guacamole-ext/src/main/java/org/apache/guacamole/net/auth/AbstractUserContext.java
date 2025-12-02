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

import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.simple.SimpleActivityRecordSet;
import org.apache.guacamole.net.auth.simple.SimpleConnectionGroup;
import org.apache.guacamole.net.auth.simple.SimpleDirectory;

/**
 * Base implementation of UserContext which provides default implementations of
 * most functions. Implementations must provide their own {@link #self()} and
 * {@link #getAuthenticationProvider()}, but otherwise need only override an
 * implemented function if they wish to actually implement the functionality
 * defined for that function by the UserContext interface.
 */
public abstract class AbstractUserContext implements UserContext {

    /**
     * The unique identifier that will be used for the root connection group if
     * {@link #getRootConnectionGroup()} is not overridden.
     */
    protected static final String DEFAULT_ROOT_CONNECTION_GROUP = "ROOT";

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns {@code null}. Implementations that
     * wish to expose REST resources specific to a user's session should
     * override this function.
     */
    @Override
    public Object getResource() throws GuacamoleException {
        return null;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation returns a {@link Directory} which contains only
     * the {@link User} returned by {@link #self()} (the current user
     * associated with this {@link UserContext}. Implementations that wish to
     * expose the existence of other users should override this function.
     */
    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {
        return new SimpleDirectory<User>(self());
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Directory}.
     * Implementations that wish to expose user groups should override this
     * function.
     */
    @Override
    public Directory<UserGroup> getUserGroupDirectory()
            throws GuacamoleException {
        return new SimpleDirectory<UserGroup>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Directory}.
     * Implementations that wish to expose connections should override this
     * function.
     */
    @Override
    public Directory<Connection> getConnectionDirectory()
            throws GuacamoleException {
        return new SimpleDirectory<Connection>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation returns a {@link Directory} which contains only
     * the root connection group returned by {@link #getRootConnectionGroup()}.
     * Implementations that wish to provide a structured connection hierarchy
     * should override this function. If only a flat list of connections will
     * be used, only {@link #getConnectionDirectory()} needs to be overridden.
     */
    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory()
            throws GuacamoleException {
        return new SimpleDirectory<ConnectionGroup>(getRootConnectionGroup());
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Directory}.
     * Implementations that wish to expose the status of active connections
     * should override this function.
     */
    @Override
    public Directory<ActiveConnection> getActiveConnectionDirectory()
            throws GuacamoleException {
        return new SimpleDirectory<ActiveConnection>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Directory}.
     * Implementations that wish to provide screen sharing functionality
     * through the use of sharing profiles should override this function.
     */
    @Override
    public Directory<SharingProfile> getSharingProfileDirectory()
            throws GuacamoleException {
        return new SimpleDirectory<SharingProfile>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link ActivityRecordSet}.
     * Implementations that wish to expose connection usage history should
     * override this function.
     */
    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        return new SimpleActivityRecordSet<ConnectionRecord>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link ActivityRecordSet}.
     * Implementations that wish to expose user login/logout history should
     * override this function.
     */
    @Override
    public ActivityRecordSet<ActivityRecord> getUserHistory()
            throws GuacamoleException {
        return new SimpleActivityRecordSet<ActivityRecord>();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation returns a new {@link ConnectionGroup} with the
     * identifier defined by {@link #DEFAULT_ROOT_CONNECTION_GROUP} and
     * containing all connections exposed by the {@link Directory} returned by
     * {@link #getConnectionDirectory()}. Implementations that wish to provide
     * a structured connection hierarchy should override this function. If only
     * a flat list of connections will be used, only
     * {@link #getConnectionDirectory()} needs to be overridden.
     */
    @Override
    public ConnectionGroup getRootConnectionGroup()
            throws GuacamoleException {
        return new SimpleConnectionGroup(
            DEFAULT_ROOT_CONNECTION_GROUP,
            DEFAULT_ROOT_CONNECTION_GROUP,
            getConnectionDirectory().getIdentifiers(),
            Collections.<String>emptySet()
        );
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Collection}.
     * Implementations that wish to expose custom user attributes as fields
     * within user edit screens should override this function.
     */
    @Override
    public Collection<Form> getUserAttributes() {
        return Collections.<Form>emptyList();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Collection}.
     * Implementations that wish to expose custom user group attributes as
     * fields within user group edit screens should override this function.
     */
    @Override
    public Collection<Form> getUserGroupAttributes() {
        return Collections.<Form>emptyList();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Collection}.
     * Implementations that wish to expose custom connection attributes as
     * fields within connection edit screens should override this function.
     */
    @Override
    public Collection<Form> getConnectionAttributes() {
        return Collections.<Form>emptyList();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Collection}.
     * Implementations that wish to expose custom connection group attributes
     * as fields within connection group edit screens should override this
     * function.
     */
    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        return Collections.<Form>emptyList();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns an empty {@link Collection}.
     * Implementations that wish to expose custom sharing profile attributes as
     * fields within sharing profile edit screens should override this function.
     */
    @Override
    public Collection<Form> getSharingProfileAttributes() {
        return Collections.<Form>emptyList();
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation does nothing. Implementations that wish to perform
     * cleanup tasks when the user associated with this {@link UserContext} is
     * being logged out should override this function.
     */
    @Override
    public void invalidate() {
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns <code>this</code>. Implementations
     * that wish to provide additional privileges to extensions requesting
     * privileged access should override this function.
     */
    @Override
    public UserContext getPrivileged() {
        return this;
    }

}
