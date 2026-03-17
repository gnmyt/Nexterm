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

package org.apache.guacamole.rest.session;

import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSession;
import org.apache.guacamole.rest.TokenParam;
import org.apache.guacamole.rest.auth.AuthenticationService;

/**
 * A REST service which exposes all data associated with Guacamole users'
 * sessions.
 */
@Path("/session")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SessionRESTService {

    /**
     * A service for authenticating users from auth tokens.
     */
    @Inject
    private AuthenticationService authenticationService;

    /**
     * Factory for creating SessionResources which expose a given
     * GuacamoleSession.
     */
    @Inject
    private SessionResourceFactory sessionResourceFactory;

    /**
     * Retrieves a resource representing the GuacamoleSession associated with
     * the given authentication token.
     *
     * @param authToken
     *     The authentication token that is used to authenticate the user
     *     having the session being exposed.
     *
     * @return
     *     A resource representing the GuacamoleSession associated with the
     *     given authentication token.
     *
     * @throws GuacamoleException
     *     If the authentication token is invalid.
     */
    @Path("/")
    public SessionResource getSessionResource(@TokenParam String authToken)
            throws GuacamoleException {

        // Return a resource exposing the retrieved session
        GuacamoleSession session = authenticationService.getGuacamoleSession(authToken);
        return sessionResourceFactory.create(authToken, session);

    }

}
