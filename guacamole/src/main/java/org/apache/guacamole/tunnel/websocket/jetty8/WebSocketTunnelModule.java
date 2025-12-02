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

package org.apache.guacamole.tunnel.websocket.jetty8;

import com.google.inject.servlet.ServletModule;
import org.apache.guacamole.tunnel.TunnelLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Loads the Jetty 8 WebSocket tunnel implementation.
 */
public class WebSocketTunnelModule extends ServletModule implements TunnelLoader {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(WebSocketTunnelModule.class);

    @Override
    public boolean isSupported() {

        try {

            // Attempt to find WebSocket servlet
            Class.forName("org.apache.guacamole.tunnel.websocket.jetty8.RestrictedGuacamoleWebSocketTunnelServlet");

            // Support found
            return true;

        }

        // If no such servlet class, this particular WebSocket support
        // is not present
        catch (ClassNotFoundException e) {}
        catch (NoClassDefFoundError e) {}

        // Support not found
        return false;
        
    }
    
    @Override
    public void configureServlets() {

        logger.info("Loading Jetty 8 WebSocket support...");
        serve("/websocket-tunnel").with(RestrictedGuacamoleWebSocketTunnelServlet.class);

    }

}
