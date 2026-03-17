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

package org.apache.guacamole.tunnel.websocket.jetty9;

import org.eclipse.jetty.websocket.api.Session;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.tunnel.TunnelRequestService;

/**
 * WebSocket listener implementation which properly parses connection IDs
 * included in the connection request.
 */
public class RestrictedGuacamoleWebSocketTunnelListener extends GuacamoleWebSocketTunnelListener {

    /**
     * Service for handling tunnel requests.
     */
    private final TunnelRequestService tunnelRequestService;

    /**
     * Creates a new WebSocketListener which uses the given TunnelRequestService
     * to create new GuacamoleTunnels for inbound requests.
     *
     * @param tunnelRequestService The service to use for inbound tunnel
     *                             requests.
     */
    public RestrictedGuacamoleWebSocketTunnelListener(TunnelRequestService tunnelRequestService) {
        this.tunnelRequestService = tunnelRequestService;
    }

    @Override
    protected GuacamoleTunnel createTunnel(Session session) throws GuacamoleException {
        return tunnelRequestService.createTunnel(new WebSocketTunnelRequest(session.getUpgradeRequest()));
    }

}
