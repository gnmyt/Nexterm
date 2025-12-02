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

package org.apache.guacamole.vault.ksm.user;

import java.util.Map;

import org.apache.guacamole.net.auth.DelegatingConnection;
import org.apache.guacamole.vault.ksm.conf.KsmAttributeService;
import org.apache.guacamole.net.auth.Connection;

import com.google.common.collect.Maps;

/**
 * A Connection that explicitly adds a blank entry for any defined KSM
 * connection attributes. This ensures that any such field will always
 * be displayed to the user when editing a connection through the UI.
 */
public class KsmConnection extends DelegatingConnection {

    /**
     * Create a new Vault connection wrapping the provided Connection record. Any
     * attributes defined in the provided connection attribute forms will have empty
     * values automatically populated when getAttributes() is called.
     *
     * @param connection
     *     The connection record to wrap.
     */
    KsmConnection(Connection connection) {
        super(connection);
    }

    /**
     * Return the underlying wrapped connection record.
     *
     * @return
     *     The wrapped connection record.
     */
    Connection getUnderlyingConnection() {
        return getDelegateConnection();
    }

    @Override
    public Map<String, String> getAttributes() {

        // Make a copy of the existing map
        Map<String, String> attributes = Maps.newHashMap(super.getAttributes());

        // Add the user-config-enabled configuration attribute
        attributes.putIfAbsent(KsmAttributeService.KSM_USER_CONFIG_ENABLED_ATTRIBUTE, null);
        return attributes;
    }

}
