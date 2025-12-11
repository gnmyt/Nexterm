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

package org.apache.guacamole.auth.radius.conf;

import net.jradius.client.RadiusClient;
import net.jradius.client.auth.CHAPAuthenticator;
import net.jradius.client.auth.EAPMD5Authenticator;
import net.jradius.client.auth.EAPTLSAuthenticator;
import net.jradius.client.auth.EAPTTLSAuthenticator;
import net.jradius.client.auth.MSCHAPv1Authenticator;
import net.jradius.client.auth.MSCHAPv2Authenticator;
import net.jradius.client.auth.PAPAuthenticator;
import net.jradius.client.auth.RadiusAuthenticator;
import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * This enum represents supported RADIUS authentication protocols for
 * the guacamole-auth-radius extension.
 */
public enum RadiusAuthenticationProtocol {
    
    /**
     * Password Authentication Protocol (PAP).
     */
    @PropertyValue("pap")
    PAP(PAPAuthenticator.NAME),
    
    /**
     * Challenge-Handshake Authentication Protocol (CHAP).
     */
    @PropertyValue("chap")
    CHAP(CHAPAuthenticator.NAME),
    
    /**
     * Microsoft implementation of CHAP, Version 1 (MS-CHAPv1).
     */
    @PropertyValue("mschapv1")
    MSCHAP_V1(MSCHAPv1Authenticator.NAME),
    
    /**
     * Microsoft implementation of CHAP, Version 2 (MS-CHAPv2).
     */
    @PropertyValue("mschapv2")
    MSCHAP_V2(MSCHAPv2Authenticator.NAME),
    
    /**
     * Extensible Authentication Protocol (EAP) with MD5 Hashing (EAP-MD5).
     */
    @PropertyValue("eap-md5")
    EAP_MD5(EAPMD5Authenticator.NAME),

    /**
     * Extensible Authentication Protocol (EAP) with TLS encryption (EAP-TLS).
     */
    @PropertyValue("eap-tls")
    EAP_TLS(EAPTLSAuthenticator.NAME),

    /**
     * Extensible Authentication Protocol (EAP) with Tunneled TLS (EAP-TTLS).
     */
    @PropertyValue("eap-ttls")
    EAP_TTLS(EAPTTLSAuthenticator.NAME);

    /**
     * The unique name of the JRadius {@link RadiusAuthenticator} that
     * implements this protocol.
     */
    public final String JRADIUS_PROTOCOL_NAME;

    /**
     * Creates a new RadiusAuthenticationProtocol associated with the given
     * JRadius protocol name.
     *
     * @param protocolName
     *     The unique name of the JRadius {@link RadiusAuthenticator} that
     *     implements this protocol.
     */
    RadiusAuthenticationProtocol(String protocolName) {
        this.JRADIUS_PROTOCOL_NAME = protocolName;
    }

    /**
     * Returns a new instance of the JRadius {@link RadiusAuthenticator} that
     * implements this protocol. This function will never return null.
     *
     * @return
     *     A new instance of the JRadius {@link RadiusAuthenticator} that
     *     implements this protocol.
     *
     * @throws IllegalStateException
     *     If a bug within the JRadius library prevents retrieval of the
     *     authenticator for a protocol that is known to be supported.
     */
    public RadiusAuthenticator getAuthenticator() throws IllegalStateException {

        // As we are using JRadius' own NAME constants for retrieving
        // authenticator instances, the retrieval operation should always
        // succeed except in the case of a bug within the JRadius library
        RadiusAuthenticator authenticator = RadiusClient.getAuthProtocol(JRADIUS_PROTOCOL_NAME);
        if (authenticator == null)
            throw new IllegalStateException(String.format("JRadius failed "
                    +"to locate its own support for protocol \"%s\". This is "
                    + "likely a bug in the JRadius library.",
                    JRADIUS_PROTOCOL_NAME));

        return authenticator;

    }

}
