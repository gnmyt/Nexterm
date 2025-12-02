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

/**
 * Information which describes how the connection to guacd should be
 * established. This includes the hostname and port which guacd is listening on,
 * as well as the type of encryption required, if any.
 *
 * @author Michael Jumper
 */
public class GuacamoleProxyConfiguration {

    /**
     * All possible types of encryption used by guacd.
     */
    public enum EncryptionMethod {

        /**
         * Unencrypted (plaintext).
         */
        NONE,

        /**
         * Encrypted with SSL or TLS.
         */
        SSL
        
    }

    /**
     * The hostname or address of the machine where guacd is running.
     */
    private final String hostname;

    /**
     * The port that guacd is listening on.
     */
    private final int port;

    /**
     * The type of encryption required by guacd.
     */
    private final EncryptionMethod encryptionMethod;

    /**
     * Creates a new GuacamoleProxyConfiguration having the given hostname,
     * port, and encryption method.
     *
     * @param hostname
     *     The hostname or address of the machine where guacd is running.
     *
     * @param port
     *     The port that guacd is listening on.
     *
     * @param encryptionMethod
     *     The type of encryption required by the instance of guacd running at
     *     the given hostname and port.
     */
    public GuacamoleProxyConfiguration(String hostname, int port,
            EncryptionMethod encryptionMethod) {
        this.hostname = hostname;
        this.port = port;
        this.encryptionMethod = encryptionMethod;
    }

    /**
     * Creates a new GuacamoleProxyConfiguration having the given hostname and
     * port, with encryption method being restricted to either NONE or SSL.
     *
     * @param hostname
     *     The hostname or address of the machine where guacd is running.
     *
     * @param port
     *     The port that guacd is listening on.
     *
     * @param ssl
     *     true if guacd requires SSL/TLS encryption, false if communication
     *     with guacd should be unencrypted.
     */
    public GuacamoleProxyConfiguration(String hostname, int port, boolean ssl) {
        this(hostname, port, ssl ? EncryptionMethod.SSL : EncryptionMethod.NONE);
    }

    /**
     * Returns the hostname or address of the machine where guacd is running.
     *
     * @return
     *     The hostname or address of the machine where guacd is running.
     */
    public String getHostname() {
        return hostname;
    }

    /**
     * Returns the port that guacd is listening on.
     *
     * @return
     *     The port that guacd is listening on.
     */
    public int getPort() {
        return port;
    }

    /**
     * Returns the type of encryption required by guacd.
     *
     * @return
     *     The type of encryption required by guacd.
     */
    public EncryptionMethod getEncryptionMethod() {
        return encryptionMethod;
    }

}
