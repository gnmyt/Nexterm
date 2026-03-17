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

package org.apache.guacamole.servlet;

import org.apache.guacamole.net.DelegatingGuacamoleTunnel;
import org.apache.guacamole.net.GuacamoleTunnel;

/**
 * Tracks the last time a particular GuacamoleTunnel was accessed. This
 * information is not necessary for tunnels associated with WebSocket
 * connections, as each WebSocket connection has its own read thread which
 * continuously checks the state of the tunnel and which will automatically
 * timeout when the underlying socket times out, but the HTTP tunnel has no
 * such thread. Because the HTTP tunnel requires the stream to be split across
 * multiple requests, tracking of activity on the tunnel must be performed
 * independently of the HTTP requests.
 */
class GuacamoleHTTPTunnel extends DelegatingGuacamoleTunnel {

    /**
     * The last time this tunnel was accessed.
     */
    private long lastAccessedTime;

    /**
     * Creates a new GuacamoleHTTPTunnel which wraps the given tunnel.
     * Absolutely all function calls on this new GuacamoleHTTPTunnel will be
     * delegated to the underlying GuacamoleTunnel.
     *
     * @param wrappedTunnel
     *     The GuacamoleTunnel to wrap within this GuacamoleHTTPTunnel.
     */
    public GuacamoleHTTPTunnel(GuacamoleTunnel wrappedTunnel) {
        super(wrappedTunnel);
    }

    /**
     * Updates this tunnel, marking it as recently accessed.
     */
    public void access() {
        lastAccessedTime = System.currentTimeMillis();
    }

    /**
     * Returns the time this tunnel was last accessed, as the number of
     * milliseconds since midnight January 1, 1970 GMT. Tunnel access must
     * be explicitly marked through calls to the access() function.
     *
     * @return
     *     The time this tunnel was last accessed.
     */
    public long getLastAccessedTime() {
        return lastAccessedTime;
    }

}
