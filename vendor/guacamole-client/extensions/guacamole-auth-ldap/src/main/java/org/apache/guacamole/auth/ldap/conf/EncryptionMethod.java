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

package org.apache.guacamole.auth.ldap.conf;

import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * All possible encryption methods which may be used when connecting to an LDAP
 * server.
 */
public enum EncryptionMethod {

    /**
     * No encryption will be used. All data will be sent to the LDAP server in
     * plaintext. Unencrypted LDAP connections use port 389 by default.
     */
    @PropertyValue("none")
    NONE(389),

    /**
     * The connection to the LDAP server will be encrypted with SSL. LDAP over
     * SSL (LDAPS) will use port 636 by default.
     */
    @PropertyValue("ssl")
    SSL(636),

    /**
     * The connection to the LDAP server will be encrypted using STARTTLS. TLS
     * connections are negotiated over the standard LDAP port of 389 - the same
     * port used for unencrypted traffic.
     */
    @PropertyValue("starttls")
    STARTTLS(389);

    /**
     * The default port of this specific encryption method. As with most
     * protocols, the default port for LDAP varies by whether SSL is used.
     */
    public final int DEFAULT_PORT;

    /**
     * Initializes this encryption method such that it is associated with the
     * given default port.
     *
     * @param defaultPort
     *     The default port to associate with this encryption method.
     */
    private EncryptionMethod(int defaultPort) {
        this.DEFAULT_PORT = defaultPort;
    }

}
