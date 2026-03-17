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

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.eclipse.jetty.websocket.api.UpgradeRequest;
import org.apache.guacamole.tunnel.TunnelRequest;

/**
 * Jetty 9 WebSocket-specific implementation of TunnelRequest.
 */
public class WebSocketTunnelRequest extends TunnelRequest {

    /**
     * All parameters passed via HTTP to the WebSocket handshake.
     */
    private final Map<String, String[]> handshakeParameters;
    
    /**
     * Creates a TunnelRequest implementation which delegates parameter and
     * session retrieval to the given UpgradeRequest.
     *
     * @param request The UpgradeRequest to wrap.
     */
    public WebSocketTunnelRequest(UpgradeRequest request) {
        this.handshakeParameters = request.getParameterMap();
    }

    @Override
    public String getParameter(String name) {

        // Pull list of values, if present
        List<String> values = getParameterValues(name);
        if (values == null || values.isEmpty())
            return null;

        // Return first parameter value arbitrarily
        return values.get(0);

    }

    @Override
    public List<String> getParameterValues(String name) {

        String[] values = handshakeParameters.get(name);
        if (values == null)
            return null;

        return Arrays.asList(values);
    }
    
}
