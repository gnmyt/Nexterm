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

package org.apache.guacamole.rest.tunnel;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import java.util.Map;
import java.util.Set;
import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.GuacamoleSession;
import org.apache.guacamole.tunnel.UserTunnel;

/**
 * A REST resource which exposes the active tunnels of a Guacamole session.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TunnelCollectionResource {

    /**
     * The GuacamoleSession containing the tunnels exposed by this resource.
     */
    private final GuacamoleSession session;

    /**
     * Factory for creating instances of resources which represent tunnels.
     */
    @Inject
    private TunnelResourceFactory tunnelResourceFactory;

    /**
     * Creates a new TunnelCollectionResource which exposes the active tunnels
     * of the given GuacamoleSession.
     *
     * @param session
     *     The GuacamoleSession whose tunnels should be exposed by this
     *     resource.
     */
    @AssistedInject
    public TunnelCollectionResource(@Assisted GuacamoleSession session) {
        this.session = session;
    }

    /**
     * Returns the UUIDs of all tunnels exposed by this
     * TunnelCollectionResource.
     *
     * @return
     *     A set containing the UUIDs of all tunnels exposed by this
     *     TunnelCollectionResource.
     */
    @GET
    public Set<String> getTunnelUUIDs() {
        return session.getTunnels().keySet();
    }

    /**
     * Retrieves the tunnel having the given UUID, returning a TunnelResource
     * representing that tunnel. If no such tunnel exists, an exception will be
     * thrown.
     *
     * @param tunnelUUID
     *     The UUID of the tunnel to return via a TunnelResource.
     *
     * @return
     *     A TunnelResource which represents the tunnel having the given UUID.
     *
     * @throws GuacamoleException
     *     If no such tunnel exists.
     */
    @Path("{tunnel}")
    public TunnelResource getTunnel(@PathParam("tunnel") String tunnelUUID)
            throws GuacamoleException {

        Map<String, UserTunnel> tunnels = session.getTunnels();

        // Pull tunnel with given UUID
        final UserTunnel tunnel = tunnels.get(tunnelUUID);
        if (tunnel == null)
            throw new GuacamoleResourceNotFoundException("No such tunnel.");

        // Return corresponding tunnel resource
        return tunnelResourceFactory.create(session.getAuthenticatedUser(), tunnel);

    }

}
