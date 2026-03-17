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

import com.google.inject.Inject;
import java.io.File;
import java.net.InetAddress;
import java.net.UnknownHostException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.Environment;

/**
 * Service for retrieving configuration information regarding the RADIUS server.
 */
public class ConfigurationService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Returns the hostname of the RADIUS server as configured with
     * guacamole.properties. By default, this will be "localhost".
     *
     * @return
     *     The hostname of the RADIUS server, as configured with
     *     guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusServer() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_HOSTNAME,
            "localhost"
        );
    }

    /**
     * Returns the UDP port that will be used to communicate authentication
     * and authorization information to the RADIUS server, as configured in
     * guacamole.properties.  By default this will be 1812.
     *
     * @return
     *     The authentication port of the RADIUS server, as configured with
     *     guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getRadiusAuthPort() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_AUTH_PORT,
            1812
        );
    }

    /**
     * Returns the UDP port that will be used to communicate accounting
     * information to the RADIUS server, as configured in
     * guacamole.properties.  The default is 1813.
     *
     * @return
     *     The accouting port of the RADIUS server, as configured with
     *     guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getRadiusAcctPort() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_ACCT_PORT,
            1813
        );
    }

    /**
     * Returns the shared secret used to communicate with the RADIUS server,
     * as configured in guacamole.properties.  This must match the value
     * in the RADIUS server configuration.
     *
     * @return
     *     The shared secret of the RADIUS server, as configured with
     *     guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusSharedSecret() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_SHARED_SECRET
        );
    }

    /**
     * Returns the authentication protocol Guacamole should use when
     * communicating with the RADIUS server, as configured in
     * guacamole.properties.  This must match the configuration
     * of the RADIUS server, so that the RADIUS server and Guacamole
     * client are "speaking the same language."
     *
     * @return
     *     The authentication protocol of the RADIUS server, 
     *     from guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public RadiusAuthenticationProtocol getRadiusAuthProtocol()
            throws GuacamoleException {
        return environment.getRequiredProperty(
            RadiusGuacamoleProperties.RADIUS_AUTH_PROTOCOL
        );
    }

    /**
     * Returns the maximum number of retries for connecting to the RADIUS server
     * from guacamole.properties.  The default number of retries is 5.
     *
     * @return
     *     The number of retries for connection to the RADIUS server,
     *     from guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getRadiusMaxRetries() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_MAX_RETRIES,
            5
        );
    }

    /**
     * Returns the timeout, in seconds, for connecting to the RADIUS server
     * from guacamole.properties.  The default timeout is 60 seconds.
     *
     * @return
     *     The timeout, in seconds, for connection to the RADIUS server,
     *     from guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getRadiusTimeout() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_TIMEOUT,
            60
        );
    }

    /**
     * Returns the CA file for validating certificates for encrypted
     * connections to the RADIUS server, as configured in
     * guacamole.properties.
     *
     * @return
     *     The file name for the CA file for validating
     *     RADIUS server certificates
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public File getRadiusCAFile() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_CA_FILE,
            new File(environment.getGuacamoleHome(), "ca.crt")
        );
    }

    /**
     * Returns the key file for the client for creating encrypted
     * connections to RADIUS servers as specified in
     * guacamole.properties.  By default a file called radius.pem
     * is used.
     *
     * @return
     *     The file name for the client certificate/key pair
     *     for making encrypted RADIUS connections.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public File getRadiusKeyFile() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_KEY_FILE,
            new File(environment.getGuacamoleHome(), "radius.key")
        );
    }

    /**
     * Returns the password for the CA file, if it is
     * password-protected, as configured in guacamole.properties.
     *
     * @return
     *     The password for the CA file
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusCAPassword() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_CA_PASSWORD
        );
    }

    /**
     * Returns the type of store that the CA file represents
     * so that it can be correctly processed by the RADIUS
     * library, as configured in guacamole.properties.  By
     * default the pem type is used.
     *
     * @return
     *     The type of store that the CA file is encoded
     *     as, as configured in guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusCAType() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_CA_TYPE,
            "pem"
        );
    }

    /**
     * Returns the password for the key file, if it is
     * password-protected, as configured in guacamole.properties.
     *
     * @return
     *     The password for the key file
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusKeyPassword() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_KEY_PASSWORD
        );
    }

    /**
     * Returns the type of store that the key file represents
     * so that it can be correctly processed by the RADIUS
     * library, as configured in guacamole.properties.  By
     * default the pem type is used.
     *
     * @return
     *     The type of store that the key file is encoded
     *     as, as configured in guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getRadiusKeyType() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_KEY_TYPE,
            "pem"
        );
    }

    /**
     * Returns the boolean value of whether or not the
     * RADIUS library should trust all server certificates
     * or should validate them against known CA certificates,
     * as configured in guacamole.properties.  By default
     * this is false, indicating that server certificates
     * must be validated against a known good CA.
     *
     * @return
     *     True if the RADIUS client should trust all
     *     server certificates; false if it should
     *     validate against known good CA certificates.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public Boolean getRadiusTrustAll() throws GuacamoleException {
        return environment.getProperty(
            RadiusGuacamoleProperties.RADIUS_TRUST_ALL,
            false
        );
    }

    /**
     * Returns the tunneled protocol that RADIUS should use
     * when the authentication protocol is set to EAP-TTLS, as
     * configured in the guacamole.properties file.
     *
     * @return
     *     The tunneled protocol that should be used inside
     *     an EAP-TTLS RADIUS connection. 
     *     
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if EAP-TTLS is specified
     *     as the inner protocol.
     */
    public RadiusAuthenticationProtocol getRadiusEAPTTLSInnerProtocol()
            throws GuacamoleException {
        
        RadiusAuthenticationProtocol authProtocol = environment.getRequiredProperty(
            RadiusGuacamoleProperties.RADIUS_EAP_TTLS_INNER_PROTOCOL
        );
        
        if (authProtocol == RadiusAuthenticationProtocol.EAP_TTLS)
            throw new GuacamoleServerException("Invalid inner protocol specified for EAP-TTLS.");
        
        return authProtocol;
        
    }
    
    /**
     * Returns the InetAddress containing the NAS IP address that should be
     * used to identify this RADIUS client when communicating with the RADIUS
     * server. If no explicit configuration of this property is defined
     * in guacamole.properties, it falls back to attempting to determine the
     * IP address using Java's built-in mechanisms for querying local addresses.
     * 
     * @return
     *     The InetAddress corresponding to the NAS IP address specified in
     *     guacamole.properties, or the IP determined by querying the address
     *     of the server on which Guacamole is running.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed, or if the InetAddress
     *     for the NAS IP cannot be read or determined from the system.
     */
    public InetAddress getRadiusNasIp() throws GuacamoleException {
        try {
            String nasIpStr = environment.getProperty(RadiusGuacamoleProperties.RADIUS_NAS_IP);
            
            // If property is specified and non-empty, attempt to return converted address.
            if (nasIpStr != null && !nasIpStr.isEmpty())
                return InetAddress.getByName(nasIpStr);
            
            // By default, return the address of the server.
            return InetAddress.getLocalHost();
                
        }
        catch (UnknownHostException e) {
            throw new GuacamoleServerException("Unknown host specified for NAS IP.", e);
        }
    }

}
