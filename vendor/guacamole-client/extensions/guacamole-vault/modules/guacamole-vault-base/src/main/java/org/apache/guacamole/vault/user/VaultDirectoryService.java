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

package org.apache.guacamole.vault.user;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserGroup;

/**
 * A service that allows a vault implementation to override the directory
 * for any entity that a user context may return.
 */
public abstract class VaultDirectoryService {

    /**
     * Given an existing User Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new User Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<User> getUserDirectory(
            Directory<User> underlyingDirectory) throws GuacamoleException {

        // By default, the provided directly will be returned unchanged
        return underlyingDirectory;
    }

    /**
     * Given an existing UserGroup Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new UserGroup Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<UserGroup> getUserGroupDirectory(
            Directory<UserGroup> underlyingDirectory) throws GuacamoleException {

        // Unless overriden in the vault implementation, the underlying directory
        // will be returned directly
        return underlyingDirectory;
    }

    /**
     * Given an existing Connection Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new Connection Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<Connection> getConnectionDirectory(
            Directory<Connection> underlyingDirectory) throws GuacamoleException {

        // By default, the provided directly will be returned unchanged
        return underlyingDirectory;
    }

    /**
     * Given an existing ConnectionGroup Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new ConnectionGroup Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<ConnectionGroup> getConnectionGroupDirectory(
            Directory<ConnectionGroup> underlyingDirectory) throws GuacamoleException {

        // By default, the provided directly will be returned unchanged
        return underlyingDirectory;
    }

    /**
     * Given an existing ActiveConnection Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new ActiveConnection Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<ActiveConnection> getActiveConnectionDirectory(
            Directory<ActiveConnection> underlyingDirectory) throws GuacamoleException {

        // By default, the provided directly will be returned unchanged
        return underlyingDirectory;
    }

    /**
     * Given an existing SharingProfile Directory, return a new Directory for
     * this vault implementation.
     *
     * @return
     *     A new SharingProfile Directory based on the provided Directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    public Directory<SharingProfile> getSharingProfileDirectory(
            Directory<SharingProfile> underlyingDirectory) throws GuacamoleException {

        // By default, the provided directly will be returned unchanged
        return underlyingDirectory;
    }

}
