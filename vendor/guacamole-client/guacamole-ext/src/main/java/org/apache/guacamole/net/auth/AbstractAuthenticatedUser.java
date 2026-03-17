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
import java.util.Set;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;

/**
 * Basic implementation of an AuthenticatedUser which uses the username to
 * determine equality. Username comparison is case-sensitive.
 */
public abstract class AbstractAuthenticatedUser extends AbstractIdentifiable
        implements AuthenticatedUser {

    /**
     * Creates a new AbstractAuthenticatedUser that considers usernames to be
     * case-sensitive or case-insensitive based on the provided case sensitivity
     * flag.
     *
     * @param caseSensitive
     *     true if usernames should be considered case-sensitive, false
     *     otherwise.
     */
    public AbstractAuthenticatedUser(boolean caseSensitive) {
        super(caseSensitive);
    }

    /**
     * Creates a new AbstractAuthenticatedUser that considers usernames to be
     * case-sensitive or case-insensitive based on the case sensitivity setting
     * of the provided {@link Environment}, as returned by
     * {@link Environment#getCaseSensitivity()}.
     *
     * @param environment
     *     The Environment that should determine whether this
     *     AbstractAuthenticatedUser considers usernames to be case-sensitive.
     */
    public AbstractAuthenticatedUser(Environment environment) {
        this(environment.getCaseSensitivity().caseSensitiveUsernames());
    }

    /**
     * Creates a new AbstractAuthenticatedUser that considers usernames to be
     * case-sensitive or case-insensitive based on the case sensitivity setting
     * of an instance of {@link LocalEnvironment}, as returned by
     * {@link LocalEnvironment#getCaseSensitivity()}.
     */
    public AbstractAuthenticatedUser() {
        this(LocalEnvironment.getInstance());
    }

    // Prior functionality now resides within AbstractIdentifiable

    @Override
    public Set<String> getEffectiveUserGroups() {
        return Collections.<String>emptySet();
    }

    @Override
    public void invalidate() {
        // Nothing to invalidate
    }

}
