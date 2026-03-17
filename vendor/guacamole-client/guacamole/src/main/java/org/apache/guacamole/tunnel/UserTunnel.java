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

package org.apache.guacamole.tunnel;

import java.util.Collection;
import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;

/**
 * Tunnel implementation which associates a given tunnel with the UserContext of
 * the user that created it.
 */
public class UserTunnel extends StreamInterceptingTunnel {

    /**
     * The UserContext associated with the user for whom this tunnel was
     * created. This UserContext MUST be from the AuthenticationProvider that
     * created this tunnel.
     */
    private final UserContext userContext;

    /**
     * Creates a new UserTunnel which wraps the given tunnel, associating it
     * with the given UserContext. The UserContext MUST be from the
     * AuthenticationProvider that created this tunnel, and MUST be associated
     * with the user for whom this tunnel was created.
     *
     * @param userContext
     *     The UserContext associated with the user for whom this tunnel was
     *     created. This UserContext MUST be from the AuthenticationProvider
     *     that created this tunnel.
     *
     * @param tunnel
     *     The tunnel whose stream-related instruction should be intercepted if
     *     interceptStream() is invoked.
     */
    public UserTunnel(UserContext userContext, GuacamoleTunnel tunnel) {
        super(tunnel);
        this.userContext = userContext;
    }

    /**
     * Returns the UserContext of the user for whom this tunnel was created.
     * This UserContext will be the UserContext from the AuthenticationProvider
     * that created this tunnel.
     *
     * @return
     *     The UserContext of the user for whom this tunnel was created.
     */
    public UserContext getUserContext() {
        return userContext;
    }

    /**
     * Returns the ActiveConnection object associated with this tunnel within
     * the AuthenticationProvider and UserContext which created the tunnel. If
     * the AuthenticationProvider is not tracking active connections, or this
     * tunnel is no longer active, this will be null.
     *
     * @return
     *     The ActiveConnection object associated with this tunnel, or null if
     *     this tunnel is no longer active or the AuthenticationProvider which
     *     created the tunnel is not tracking active connections.
     *
     * @throws GuacamoleException
     *     If an error occurs which prevents retrieval of the user's current
     *     active connections.
     */
    public ActiveConnection getActiveConnection() throws GuacamoleException {

        // Pull the UUID of the current tunnel
        UUID uuid = getUUID();

        // Get the directory of active connections
        Directory<ActiveConnection> activeConnectionDirectory = userContext.getActiveConnectionDirectory();
        Collection<String> activeConnectionIdentifiers = activeConnectionDirectory.getIdentifiers();

        // Search all connections for a tunnel which matches this tunnel
        for (ActiveConnection activeConnection : activeConnectionDirectory.getAll(activeConnectionIdentifiers)) {

            // If we lack access, continue with next tunnel
            GuacamoleTunnel tunnel = activeConnection.getTunnel();
            if (tunnel == null)
                continue;

            // Tunnels are equivalent if they have the same UUID
            if (uuid.equals(tunnel.getUUID()))
                return activeConnection;

        }

        // No active connection associated with this tunnel
        return null;

    }

}
