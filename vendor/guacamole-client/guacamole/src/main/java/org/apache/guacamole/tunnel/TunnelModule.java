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

import org.apache.guacamole.tunnel.http.RestrictedGuacamoleHTTPTunnelServlet;
import com.google.inject.servlet.ServletModule;
import java.lang.reflect.InvocationTargetException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Module which loads tunnel implementations.
 */
public class TunnelModule extends ServletModule {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(TunnelModule.class);

    /**
     * Classnames of all implementation-specific WebSocket tunnel modules.
     */
    private static final String[] WEBSOCKET_MODULES = {
        "org.apache.guacamole.tunnel.websocket.WebSocketTunnelModule",
        "org.apache.guacamole.tunnel.websocket.jetty8.WebSocketTunnelModule",
        "org.apache.guacamole.tunnel.websocket.jetty9.WebSocketTunnelModule",
        "org.apache.guacamole.tunnel.websocket.tomcat.WebSocketTunnelModule"
    };

    private boolean loadWebSocketModule(String classname) {

        try {

            // Attempt to find WebSocket module
            Class<?> module = Class.forName(classname);

            // Create loader
            TunnelLoader loader = (TunnelLoader) module.getConstructor().newInstance();

            // Install module, if supported
            if (loader.isSupported()) {
                install(loader);
                return true;
            }

        }

        // If no such class or constructor, etc., then this particular
        // WebSocket support is not present
        catch (ClassNotFoundException e) {}
        catch (NoClassDefFoundError e) {}
        catch (NoSuchMethodException e) {}

        // Log errors which indicate bugs
        catch (InstantiationException e) {
            logger.debug("Error instantiating WebSocket module.", e);
        }
        catch (IllegalAccessException e) {
            logger.debug("Error instantiating WebSocket module.", e);
        }
        catch (InvocationTargetException e) {
            logger.debug("Error instantiating WebSocket module.", e);
        }

        // Load attempt failed
        return false;

    }

    @Override
    protected void configureServlets() {

        bind(TunnelRequestService.class);

        // Set up HTTP tunnel
        serve("/tunnel").with(RestrictedGuacamoleHTTPTunnelServlet.class);

        // Try to load each WebSocket tunnel in sequence
        for (String classname : WEBSOCKET_MODULES) {
            if (loadWebSocketModule(classname)) {
                logger.debug("WebSocket module loaded: {}", classname);
                return;
            }
        }

        // Warn of lack of WebSocket
        logger.info("WebSocket support NOT present. Only HTTP will be used.");

    }

}
