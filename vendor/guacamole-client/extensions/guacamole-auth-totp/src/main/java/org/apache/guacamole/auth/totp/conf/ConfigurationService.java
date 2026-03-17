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

package org.apache.guacamole.auth.totp.conf;

import com.google.inject.Inject;
import inet.ipaddr.IPAddress;
import java.util.Collections;
import java.util.List;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.apache.guacamole.properties.IPAddressListProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;
import org.apache.guacamole.totp.TOTPGenerator;

/**
 * Service for retrieving configuration information regarding the TOTP
 * authentication extension.
 */
public class ConfigurationService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * The human-readable name of the entity issuing user accounts. By default,
     * this will be "Apache Guacamole".
     */
    private static final StringGuacamoleProperty TOTP_ISSUER =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "totp-issuer"; }

    };

    /**
     * The number of digits which should be included in each generated TOTP
     * code. By default, this will be 6.
     */
    private static final IntegerGuacamoleProperty TOTP_DIGITS=
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "totp-digits"; }

    };

    /**
     * The duration that each generated code should remain valid, in seconds.
     * By default, this will be 30.
     */
    private static final IntegerGuacamoleProperty TOTP_PERIOD =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "totp-period"; }

    };

    /**
     * The hash algorithm that should be used to generate TOTP codes. By
     * default, this will be "sha1". Legal values are "sha1", "sha256", and
     * "sha512".
     */
    private static final EnumGuacamoleProperty<TOTPGenerator.Mode> TOTP_MODE =
            new EnumGuacamoleProperty<TOTPGenerator.Mode>(TOTPGenerator.Mode.class) {

        @Override
        public String getName() { return "totp-mode"; }

    };
    
    /**
     * A property that contains a list of IP addresses and/or subnets for which
     * MFA via the TOTP module should be bypassed. Users logging in from addresses
     * contained in this list will not be prompted for a second authentication
     * factor. If this property is empty or not defined, and the TOTP module
     * is installed, all users will be prompted for MFA.
     */
    private static final IPAddressListProperty TOTP_BYPASS_HOSTS =
            new IPAddressListProperty() {
                
        @Override
        public String getName() { return "totp-bypass-hosts"; }
                
    };
    
    /**
     * A property that contains a list of IP addresses and/or subnets for which
     * MFA via the TOTP module should explicitly be enabled. If this property is defined,
     * and the TOTP module is installed, users logging in from hosts contained
     * in this list will be prompted for MFA, and users logging in from all
     * other hosts will not be prompted for MFA.
     */
    private static final IPAddressListProperty TOTP_ENFORCE_HOSTS =
            new IPAddressListProperty() {
    
        @Override
        public String getName() { return "totp-enforce-hosts"; }
                
    };

    /**
     * Returns the human-readable name of the entity issuing user accounts. If
     * not specified, "Apache Guacamole" will be used by default.
     *
     * @return
     *     The human-readable name of the entity issuing user accounts.
     *
     * @throws GuacamoleException
     *     If the "totp-issuer" property cannot be read from
     *     guacamole.properties.
     */
    public String getIssuer() throws GuacamoleException {
        return environment.getProperty(TOTP_ISSUER, "Apache Guacamole");
    }

    /**
     * Returns the number of digits which should be included in each generated
     * TOTP code. If not specified, 6 will be used by default.
     *
     * @return
     *     The number of digits which should be included in each generated
     *     TOTP code.
     *
     * @throws GuacamoleException
     *     If the "totp-digits" property cannot be read from
     *     guacamole.properties.
     */
    public int getDigits() throws GuacamoleException {

        // Validate legal number of digits
        int digits = environment.getProperty(TOTP_DIGITS, 6);
        if (digits < 6 || digits > 8)
            throw new GuacamoleServerException("TOTP codes may have no fewer "
                    + "than 6 digits and no more than 8 digits.");

        return digits;

    }

    /**
     * Returns the duration that each generated code should remain valid, in
     * seconds. If not specified, 30 will be used by default.
     *
     * @return
     *     The duration that each generated code should remain valid, in
     *     seconds.
     *
     * @throws GuacamoleException
     *     If the "totp-period" property cannot be read from
     *     guacamole.properties.
     */
    public int getPeriod() throws GuacamoleException {
        return environment.getProperty(TOTP_PERIOD, 30);
    }

    /**
     * Returns the hash algorithm that should be used to generate TOTP codes. If
     * not specified, SHA1 will be used by default.
     *
     * @return
     *     The hash algorithm that should be used to generate TOTP codes.
     *
     * @throws GuacamoleException
     *     If the "totp-mode" property cannot be read from
     *     guacamole.properties.
     */
    public TOTPGenerator.Mode getMode() throws GuacamoleException {
        return environment.getProperty(TOTP_MODE, TOTPGenerator.Mode.SHA1);
    }
    
    /**
     * Return the list of IP addresses and/or subnets for which MFA authentication via the
     * TOTP module should be bypassed, allowing users from those addresses to log in
     * without the MFA requirement.
     * 
     * @return
     *     A list of IP addresses and/or subnets for which MFA authentication
     *     should be bypassed.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed, or an invalid IP address
     *     or subnet is specified.
     */
    public List<IPAddress> getBypassHosts() throws GuacamoleException {
        return environment.getProperty(TOTP_BYPASS_HOSTS, Collections.emptyList());
    }
    
    /**
     * Return the list of IP addresses and/or subnets for which MFA authentication via the TOTP
     * module should be explicitly enabled, requiring users logging in from hosts specified in
     * the list to complete MFA.
     * 
     * @return
     *     A list of IP addresses and/or subnets for which MFA authentication
     *     should be explicitly enabled.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed, or an invalid IP address
     *     or subnet is specified.
     */
    public List<IPAddress> getEnforceHosts() throws GuacamoleException {
        return environment.getProperty(TOTP_ENFORCE_HOSTS, Collections.emptyList());
    }

}
