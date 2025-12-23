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

import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.apache.guacamole.properties.FileGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;


/**
 * Provides properties required for use of the RADIUS authentication provider.
 * These properties will be read from guacamole.properties when the RADIUS
 * authentication provider is used.
 */
public class RadiusGuacamoleProperties {

    /**
     * This class should not be instantiated.
     */
    private RadiusGuacamoleProperties() {}

    /**
     * The port on the RADIUS server to connect to when authenticating users.
     */
    public static final IntegerGuacamoleProperty RADIUS_AUTH_PORT = new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "radius-auth-port"; }

    };

    /**
     * The port on the server to connect to when performing RADIUS accounting.
     */
    public static final IntegerGuacamoleProperty RADIUS_ACCT_PORT = new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "radius-acct-port"; }

    };


    /**
     * The hostname or IP address of the RADIUS server to connect to when authenticating users.
     */
    public static final StringGuacamoleProperty RADIUS_HOSTNAME = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-hostname"; }

    };

    /**
     * The shared secret to use when connecting to the RADIUS server.
     */
    public static final StringGuacamoleProperty RADIUS_SHARED_SECRET = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-shared-secret"; }

    };

    /**
     * The authentication protocol of the RADIUS server to connect to when authenticating users.
     */
    public static final EnumGuacamoleProperty<RadiusAuthenticationProtocol> RADIUS_AUTH_PROTOCOL =
            new EnumGuacamoleProperty<RadiusAuthenticationProtocol>(RadiusAuthenticationProtocol.class) {

        @Override
        public String getName() { return "radius-auth-protocol"; }

    };

    /**
     * The maximum number of retries when attempting a RADIUS packet transaction.
     */
    public static final IntegerGuacamoleProperty RADIUS_MAX_RETRIES = new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "radius-max-retries"; }

    };

    /**
     * The network timeout, in seconds, when attempting a RADIUS packet transaction.
     */
    public static final IntegerGuacamoleProperty RADIUS_TIMEOUT = new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "radius-timeout"; }

    };

    /**
     * The CA file to use to validate RADIUS server certificates.
     */
    public static final FileGuacamoleProperty RADIUS_CA_FILE = new FileGuacamoleProperty() {

        @Override
        public String getName() { return "radius-ca-file"; }

    };

    /**
     * The type of file the RADIUS CA file is (PEM, PKCS12, DER).
     */
    public static final StringGuacamoleProperty RADIUS_CA_TYPE = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-ca-type"; }

    };

    /**
     * The password for the CA file.
     */
    public static final StringGuacamoleProperty RADIUS_CA_PASSWORD = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-ca-password"; }

    };

    /**
     * The file that stores the key/certificate pair to use for the RADIUS client connection.
     */
    public static final FileGuacamoleProperty RADIUS_KEY_FILE = new FileGuacamoleProperty() {

        @Override
        public String getName() { return "radius-key-file"; }

    };

    /**
     * The type of file the RADIUS key file is (PEM, PKCS12, DER).
     */
    public static final StringGuacamoleProperty RADIUS_KEY_TYPE = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-key-type"; }

    };

    /**
     * The password for the key file.
     */
    public static final StringGuacamoleProperty RADIUS_KEY_PASSWORD = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "radius-key-password"; }

    };

    /**
     * Whether or not to trust all RADIUS server certificates.
     */
    public static final BooleanGuacamoleProperty RADIUS_TRUST_ALL = new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "radius-trust-all"; }

    };

    /**
     * The tunneled protocol to use inside a RADIUS EAP-TTLS connection.
     */
    public static final EnumGuacamoleProperty<RadiusAuthenticationProtocol> RADIUS_EAP_TTLS_INNER_PROTOCOL =
            new EnumGuacamoleProperty<RadiusAuthenticationProtocol>(RadiusAuthenticationProtocol.class) {

        @Override
        public String getName() { return "radius-eap-ttls-inner-protocol"; }

    };
    
    /**
     * Manually configure the NAS IP address that the RADIUS client will pass
     * to the server when requesting authentication. Normally this is automatically
     * determined by gathering the IP address of the system on which Guacamole
     * is running; however, there are certain scenarios (as in running in a
     * Docker container) where specifying this manually may be useful.
     */
    public static final StringGuacamoleProperty RADIUS_NAS_IP = new StringGuacamoleProperty() {
        
        @Override
        public String getName() { return "radius-nas-ip"; }
        
    };

}
