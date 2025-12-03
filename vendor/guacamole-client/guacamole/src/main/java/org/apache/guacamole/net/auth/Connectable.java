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
 * Internal, ABI-compatible version of the Connectable interface from
 * guacamole-ext which defines fallback defaults for older versions of the API.
 * As this interface will take precedence in the servlet container's
 * classloader over the definition from guacamole-ext, this allows backwards
 * compatibility with the 1.0.0 API while keeping the actual API definition
 * within guacamole-ext strict.
 *
 * <p>For this to work, this interface definition <strong>MUST</strong> be 100%
 * ABI-compatible with the Connectable interface defined by guacamole-ext in
 * 1.0.0 and onward.
 */
public interface Connectable {

    /**
     * Establishes a connection to guacd using the information associated with
     * this object. The connection will be provided the given client
     * information.
     *
     * <p>This definition is the legacy connect() definition from 1.0.0 and
     * older. It is redefined here for the sake of ABI compatibility with
     * 1.0.0 but is deprecated within guacamole-ext.
     *
     * @deprecated
     *     This definition exists solely for binary compatibility. It should
     *     never be used by new code. New implementations should instead use
     *     the current version of connect() as defined by guacamole-ext.
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

        // Pass through usages of the old API to the new API
        return this.connect(info, Collections.emptyMap());

    }

    /**
     * {@inheritDoc}
     *
     * <p>This definition is the current version of connect() as defined by
     * guacamole-ext.
     *
     * <p>A default implementation which invokes the old, deprecated
     * {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation)}
     * is provided solely for compatibility with extensions which implement only
     * the old version of this function. This default implementation is useful
     * only for extensions relying on the older API and will be removed when
     * support for that version of the API is removed.
     *
     * @see
     *     The definition of getActiveConnections() in the current version of
     *     the Connectable interface, as defined by guacamole-ext.
     */
    default GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Allow old implementations of Connectable to continue to work
        return this.connect(info);

    }

    /**
     * {@inheritDoc}
     *
     * @see
     *     The definition of getActiveConnections() in the current version of
     *     the Connectable interface, as defined by guacamole-ext.
     */
    int getActiveConnections();
    
}
