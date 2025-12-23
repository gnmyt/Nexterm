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

package org.apache.guacamole.tunnel.http;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.tunnel.TunnelRequestService;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.servlet.GuacamoleHTTPTunnelServlet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Connects users to a tunnel associated with the authorized connection
 * having the given ID.
 */
@Singleton
public class RestrictedGuacamoleHTTPTunnelServlet extends GuacamoleHTTPTunnelServlet {

    /**
     * Service for handling tunnel requests.
     */
    @Inject
    private TunnelRequestService tunnelRequestService;
    
    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(RestrictedGuacamoleHTTPTunnelServlet.class);

    @Override
    protected GuacamoleTunnel doConnect(HttpServletRequest request) throws GuacamoleException {

        // Attempt to create HTTP tunnel
        GuacamoleTunnel tunnel = tunnelRequestService.createTunnel(new HTTPTunnelRequest(request));

        // If successful, warn of lack of WebSocket
        logger.info("Using HTTP tunnel (not WebSocket). Performance may be sub-optimal.");

        return tunnel;

    }

}
