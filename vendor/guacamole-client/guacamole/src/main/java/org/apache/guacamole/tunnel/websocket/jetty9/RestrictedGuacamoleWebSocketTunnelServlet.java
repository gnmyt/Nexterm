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

import javax.inject.Inject;
import javax.inject.Singleton;
import org.eclipse.jetty.websocket.servlet.WebSocketServlet;
import org.eclipse.jetty.websocket.servlet.WebSocketServletFactory;
import org.apache.guacamole.tunnel.TunnelRequestService;

/**
 * A WebSocketServlet partial re-implementation of GuacamoleTunnelServlet.
 */
@Singleton
public class RestrictedGuacamoleWebSocketTunnelServlet extends WebSocketServlet {

    /**
     * Service for handling tunnel requests.
     */
    @Inject
    private TunnelRequestService tunnelRequestService;
 
    @Override
    public void configure(WebSocketServletFactory factory) {

        // Register WebSocket implementation
        factory.setCreator(new RestrictedGuacamoleWebSocketCreator(tunnelRequestService));
        
    }
    
}

