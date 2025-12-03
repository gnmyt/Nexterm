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

package org.apache.guacamole.auth.json;

import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.ByteArrayProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;

/**
 * Service for retrieving configuration information regarding the JSON
 * authentication provider.
 */
public class ConfigurationService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;
    
    /**
     * The encryption key to use for all decryption and signature verification.
     */
    private static final ByteArrayProperty JSON_SECRET_KEY = new ByteArrayProperty() {

        @Override
        public String getName() {
            return "json-secret-key";
        }

    };

    /**
     * A comma-separated list of all IP addresses or CIDR subnets which should
     * be allowed to perform authentication. If not specified, ALL address will
     * be allowed.
     */
    private static final StringGuacamoleProperty JSON_TRUSTED_NETWORKS = new StringGuacamoleProperty() {

        @Override
        public String getName() {
            return "json-trusted-networks";
        }

    };

    /**
     * Returns the symmetric key which will be used to encrypt and sign all
     * JSON data and should be used to decrypt and verify any received JSON
     * data. This is dictated by the "json-secret-key" property specified
     * within guacamole.properties.
     *
     * @return
     *     The key which should be used to decrypt received JSON data.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if the
     *     "json-secret-key" property is missing.
     */
    public byte[] getSecretKey() throws GuacamoleException {
        return environment.getRequiredProperty(JSON_SECRET_KEY);
    }

    /**
     * Returns a collection of all IP address or CIDR subnets which should be
     * allowed to submit authentication requests. If empty, authentication
     * attempts will be allowed through without restriction.
     *
     * @return
     *     A collection of all IP address or CIDR subnets which should be
     *     allowed to submit authentication requests.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public Collection<String> getTrustedNetworks() throws GuacamoleException {
        return environment.getPropertyCollection(JSON_TRUSTED_NETWORKS, Collections.<String>emptyList());
    }

}
