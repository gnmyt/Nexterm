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

package org.apache.guacamole.rest.schema;

import java.util.Collection;
import java.util.Map;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.protocols.ProtocolInfo;

/**
 * A REST resource which provides access to descriptions of the properties,
 * attributes, etc. of objects within a particular UserContext.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SchemaResource {

    /**
     * The UserContext whose schema is exposed by this SchemaResource.
     */
    private final UserContext userContext;

    /**
     * Creates a new SchemaResource which exposes meta information describing
     * the kind of data within the given UserContext.
     *
     * @param userContext
     *     The UserContext whose schema should be exposed by this
     *     SchemaResource.
     */
    public SchemaResource(UserContext userContext) {
        this.userContext = userContext;
    }

    /**
     * Retrieves the possible attributes of a user object.
     *
     * @return
     *     A collection of forms which describe the possible attributes of a
     *     user object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("userAttributes")
    public Collection<Form> getUserAttributes() throws GuacamoleException {

        // Retrieve all possible user attributes
        return userContext.getUserAttributes();

    }

    /**
     * Retrieves the possible user preference attributes of a user object.
     *
     * @return
     *     A collection of forms which describe the possible preference attributes of a
     *     user object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("userPreferenceAttributes")
    public Collection<Form> getUserPreferenceAttributes()
            throws GuacamoleException {

        // Retrieve all possible user preference attributes
        return userContext.getUserPreferenceAttributes();

    }

    /**
     * Retrieves the possible attributes of a user group object.
     *
     * @return
     *     A collection of forms which describe the possible attributes of a
     *     user group object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("userGroupAttributes")
    public Collection<Form> getUserGroupAttributes() throws GuacamoleException {

        // Retrieve all possible user group attributes
        return userContext.getUserGroupAttributes();

    }

    /**
     * Retrieves the possible attributes of a connection object.
     *
     * @return
     *     A collection of forms which describe the possible attributes of a
     *     connection object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("connectionAttributes")
    public Collection<Form> getConnectionAttributes()
            throws GuacamoleException {

        // Retrieve all possible connection attributes
        return userContext.getConnectionAttributes();

    }

    /**
     * Retrieves the possible attributes of a sharing profile object.
     *
     * @return
     *     A collection of forms which describe the possible attributes of a
     *     sharing profile object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("sharingProfileAttributes")
    public Collection<Form> getSharingProfileAttributes()
            throws GuacamoleException {

        // Retrieve all possible sharing profile attributes
        return userContext.getSharingProfileAttributes();

    }

    /**
     * Retrieves the possible attributes of a connection group object.
     *
     * @return
     *     A collection of forms which describe the possible attributes of a
     *     connection group object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the possible attributes.
     */
    @GET
    @Path("connectionGroupAttributes")
    public Collection<Form> getConnectionGroupAttributes()
            throws GuacamoleException {

        // Retrieve all possible connection group attributes
        return userContext.getConnectionGroupAttributes();

    }

    /**
     * Gets a map of protocols defined in the system - protocol name to protocol.
     *
     * @return
     *     A map of protocol information, where each key is the unique name
     *     associated with that protocol.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the available protocols.
     */
    @GET
    @Path("protocols")
    public Map<String, ProtocolInfo> getProtocols() throws GuacamoleException {

        // Get and return a map of all protocols.
        Environment env = LocalEnvironment.getInstance();
        return env.getProtocols();

    }

}
