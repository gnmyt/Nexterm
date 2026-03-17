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

package org.apache.guacamole.protocol;

/**
 * Capabilities which may not be present in all versions of the Guacamole
 * protocol.
 */
public enum GuacamoleProtocolCapability {
    
    /**
     * The protocol does not require handshake instructions to be sent in a
     * specific order, nor that all handshake instructions be sent. Arbitrary
     * handshake order was introduced in
     * {@link GuacamoleProtocolVersion#VERSION_1_1_0}.
     */
    ARBITRARY_HANDSHAKE_ORDER(GuacamoleProtocolVersion.VERSION_1_1_0),
    
    /**
     * Support for the "msg" instruction. The "msg" instruction allows the
     * server to send messages to the client. Support for this instruction was
     * introduced in {@link GuacamoleProtocolVersion#VERSION_1_5_0}.
     */
    MSG_INSTRUCTION(GuacamoleProtocolVersion.VERSION_1_5_0),
    
    /**
     * Support for the "name" handshake instruction, allowing clients to send
     * the name of the Guacamole user to be passed to guacd and associated with
     * connections. Support for this instruction was introduced in
     * {@link GuacamoleProtocolVersion#VERSION_1_5_0}.
     */
    NAME_HANDSHAKE(GuacamoleProtocolVersion.VERSION_1_5_0),
    
    /**
     * Negotiation of Guacamole protocol version between client and server
     * during the protocol handshake. The ability to negotiate protocol
     * versions was introduced in
     * {@link GuacamoleProtocolVersion#VERSION_1_1_0}.
     */
    PROTOCOL_VERSION_DETECTION(GuacamoleProtocolVersion.VERSION_1_1_0),

    /**
     * Support for the "required" instruction. The "required" instruction
     * allows the server to explicitly request connection parameters from the
     * client without which the connection cannot continue, such as user
     * credentials. Support for this instruction was introduced in
     * {@link GuacamoleProtocolVersion#VERSION_1_3_0}.
     */
    REQUIRED_INSTRUCTION(GuacamoleProtocolVersion.VERSION_1_3_0),

    /**
     * Support for the "timezone" handshake instruction. The "timezone"
     * instruction allows the client to request that the server forward their
     * local timezone for use within the remote desktop session. Support for
     * forwarding the client timezone was introduced in
     * {@link GuacamoleProtocolVersion#VERSION_1_1_0}.
     */
    TIMEZONE_HANDSHAKE(GuacamoleProtocolVersion.VERSION_1_1_0);
    
    /**
     * The minimum protocol version required to support this capability.
     */
    private final GuacamoleProtocolVersion version;
    
    /**
     * Create a new enum value with the given protocol version as the minimum
     * required to support the capability.
     * 
     * @param version
     *     The minimum required protocol version for supporting the
     *     capability.
     */
    private GuacamoleProtocolCapability(GuacamoleProtocolVersion version) {
        this.version = version;
    }

    /**
     * Returns whether this capability is supported in the given Guacamole
     * protocol version.
     *
     * @param version
     *     The Guacamole protocol version to check.
     *
     * @return
     *     true if this capability is supported by the given protocol version,
     *     false otherwise.
     */
    public boolean isSupported(GuacamoleProtocolVersion version) {
        return version.atLeast(this.version);
    }

}
