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

package org.apache.guacamole.auth.jdbc.tunnel;

import java.util.Collection;
import java.util.Map;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.connection.ModeledConnection;
import org.apache.guacamole.auth.jdbc.connectiongroup.ModeledConnectionGroup;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.sharing.connection.SharedConnectionDefinition;
import org.apache.guacamole.auth.jdbc.user.RemoteAuthenticatedUser;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;


/**
 * Service which creates pre-configured GuacamoleSocket instances for
 * connections and balancing groups, applying concurrent usage rules.
 */
public interface GuacamoleTunnelService {

    /**
     * Returns a collection containing connection records representing all
     * currently-active connections visible by the given user.
     *
     * @param user
     *     The user retrieving active connections.
     *
     * @return
     *     A collection containing connection records representing all
     *     currently-active connections.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving all active connections, or if
     *     permission is denied.
     */
    public Collection<ActiveConnectionRecord> getActiveConnections(ModeledAuthenticatedUser user)
            throws GuacamoleException;

    /**
     * Creates a socket for the given user which connects to the given
     * connection. The given client information will be passed to guacd when
     * the connection is established. This function will apply any concurrent
     * usage rules in effect, but will NOT test object- or system-level
     * permissions.
     *
     * @param user
     *     The user for whom the connection is being established.
     *
     * @param connection
     *     The connection the user is connecting to.
     *
     * @param info
     *     Information describing the Guacamole client connecting to the given
     *     connection.
     *
     * @param tokens
     *     A Map containing the token names and corresponding values to be
     *     applied as parameter tokens when establishing the connection.
     *
     * @return
     *     A new GuacamoleTunnel which is configured and connected to the given
     *     connection.
     *
     * @throws GuacamoleException
     *     If the connection cannot be established due to concurrent usage
     *     rules.
     */
    GuacamoleTunnel getGuacamoleTunnel(ModeledAuthenticatedUser user,
            ModeledConnection connection, GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException;

    /**
     * Returns a collection containing connection records representing all
     * currently-active connections using the given connection. These records
     * will have usernames and start dates, but no end date, and will be
     * sorted in ascending order by start date.
     *
     * @param connection
     *     The connection to check.
     *
     * @return
     *     A collection containing connection records representing all
     *     currently-active connections.
     */
    public Collection<ActiveConnectionRecord> getActiveConnections(Connection connection);

    /**
     * Creates a socket for the given user which connects to the given
     * connection group. The given client information will be passed to guacd
     * when the connection is established. This function will apply any
     * concurrent usage rules in effect, but will NOT test object- or
     * system-level permissions.
     *
     * @param user
     *     The user for whom the connection is being established.
     *
     * @param connectionGroup
     *     The connection group the user is connecting to.
     *
     * @param info
     *     Information describing the Guacamole client connecting to the given
     *     connection group.
     *
     * @param tokens
     *     A Map containing the token names and corresponding values to be
     *     applied as parameter tokens when establishing the connection.
     *
     * @return
     *     A new GuacamoleTunnel which is configured and connected to the given
     *     connection group.
     *
     * @throws GuacamoleException
     *     If the connection cannot be established due to concurrent usage
     *     rules, or if the connection group is not balancing.
     */
    GuacamoleTunnel getGuacamoleTunnel(ModeledAuthenticatedUser user,
            ModeledConnectionGroup connectionGroup,
            GuacamoleClientInformation info, Map<String, String> tokens)
            throws GuacamoleException;

    /**
     * Returns a collection containing connection records representing all
     * currently-active connections using the given connection group. These
     * records will have usernames and start dates, but no end date, and will
     * be sorted in ascending order by start date.
     *
     * @param connectionGroup
     *     The connection group to check.
     *
     * @return
     *     A collection containing connection records representing all
     *     currently-active connections.
     */
    public Collection<ActiveConnectionRecord> getActiveConnections(ConnectionGroup connectionGroup);

    /**
     * Creates a socket for the given user which joins the given active
     * connection. The given client information will be passed to guacd when
     * the connection is established. This function will apply any concurrent
     * usage rules in effect, but will NOT test object- or system-level
     * permissions.
     *
     * @param user
     *     The user for whom the connection is being established.
     *
     * @param definition
     *     The SharedConnectionDefinition dictating the connection being shared
     *     and any associated restrictions.
     *
     * @param info
     *     Information describing the Guacamole client connecting to the given
     *     connection.
     *
     * @param tokens
     *     A Map containing the token names and corresponding values to be
     *     applied as parameter tokens when establishing the connection.
     *
     * @return
     *     A new GuacamoleTunnel which is configured and connected to the given
     *     active connection.
     *
     * @throws GuacamoleException
     *     If the connection cannot be established due to concurrent usage
     *     rules.
     */
    GuacamoleTunnel getGuacamoleTunnel(RemoteAuthenticatedUser user,
            SharedConnectionDefinition definition,
            GuacamoleClientInformation info, Map<String, String> tokens)
            throws GuacamoleException;

}
