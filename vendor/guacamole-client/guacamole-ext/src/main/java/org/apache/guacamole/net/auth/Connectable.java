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

package org.apache.guacamole.net.auth;

import java.util.Collections;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * An object which Guacamole can connect to.
 */
public interface Connectable {

    /*
     * IMPORTANT:
     * ----------
     * The web application (guacamole) defines its own version of this
     * interface containing defaults which allow backwards compatibility with
     * 1.0.0. Any changes to this interface MUST be properly reflected in that
     * copy of the interface such that they are binary compatible.
     */

    /**
     * Establishes a connection to guacd using the information associated with
     * this object. The connection will be provided the given client
     * information.
     *
     * @deprecated
     *     This function has been deprecated in favor of
     *     {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation, java.util.Map)},
     *     which allows for connection parameter tokens to be injected and
     *     applied by cooperating extensions, replacing the functionality
     *     previously provided through the {@link org.apache.guacamole.token.StandardTokens}
     *     class. It continues to be defined on this interface for
     *     compatibility. <strong>New implementations should instead implement
     *     {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation, java.util.Map)}.</strong>
     *
     * @param info
     *     Information associated with the connecting client.
     *
     * @return
     *     A fully-established GuacamoleTunnel.
     *
     * @throws GuacamoleException
     *     If an error occurs while connecting to guacd, or if permission to
     *     connect is denied.
     */
    @Deprecated
    default GuacamoleTunnel connect(GuacamoleClientInformation info)
            throws GuacamoleException {
        return this.connect(info, Collections.emptyMap());
    }

    /**
     * Establishes a connection to guacd using the information associated with
     * this object. The connection will be provided the given client
     * information. Implementations which support parameter tokens should
     * apply the given tokens when configuring the connection, such as with a
     * {@link org.apache.guacamole.token.TokenFilter}.
     *
     * @see <a href="http://guacamole.apache.org/doc/gug/configuring-guacamole.html#parameter-tokens">Parameter Tokens</a>
     *
     * @param info
     *     Information associated with the connecting client.
     *
     * @param tokens
     *     A Map containing the token names and corresponding values to be
     *     applied as parameter tokens when establishing the connection. If the
     *     implementation does not support parameter tokens, this Map may be
     *     ignored.
     *
     * @return
     *     A fully-established GuacamoleTunnel.
     *
     * @throws GuacamoleException
     *     If an error occurs while connecting to guacd, or if permission to
     *     connect is denied.
     */
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException;

    /**
     * Returns the number of active connections associated with this object.
     * Implementations may simply return 0 if this value is not tracked.
     *
     * @return
     *     The number of active connections associated with this object.
     */
    public int getActiveConnections();
    
}
