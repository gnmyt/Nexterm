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

package org.apache.guacamole.rest.history;

import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.simple.SimpleActivityRecordSet;

/**
 * A REST resource for retrieving and managing the history records of Guacamole
 * objects.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class HistoryResource {

    /**
     * The UserContext whose associated connection history is being exposed.
     */
    private final UserContext userContext;

    /**
     * Creates a new HistoryResource which exposes the connection history
     * associated with the given UserContext.
     *
     * @param userContext
     *     The UserContext whose connection history should be exposed.
     */
    public HistoryResource(UserContext userContext) {
        this.userContext = userContext;
    }

    /**
     * Retrieves the usage history for all connections. Filtering may be
     * applied via the returned ConnectionHistoryResource.
     *
     * @return
     *     A resource which exposes connection records that may optionally be
     *     filtered, each record describing the start and end times that a
     *     particular connection was used.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the connection history.
     */
    @Path("connections")
    public ConnectionHistoryResource getConnectionHistory() throws GuacamoleException {
        try {
            return new ConnectionHistoryResource(userContext.getConnectionHistory());
        }
        catch (GuacamoleUnsupportedException e) {
            return new ConnectionHistoryResource(new SimpleActivityRecordSet<>());
        }
    }

    /**
     * Retrieves the login history for all users. Filtering may be applied via
     * the returned UserHistoryResource.
     *
     * @return
     *     A resource which exposes user records that may optionally be
     *     filtered, each record describing the start and end times of a user
     *     session.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user history.
     */
    @Path("users")
    public UserHistoryResource getUserHistory() throws GuacamoleException {
        try {
            return new UserHistoryResource(userContext.getUserHistory());
        }
        catch (GuacamoleUnsupportedException e) {
            return new UserHistoryResource(new SimpleActivityRecordSet<>());
        }
    }

}
