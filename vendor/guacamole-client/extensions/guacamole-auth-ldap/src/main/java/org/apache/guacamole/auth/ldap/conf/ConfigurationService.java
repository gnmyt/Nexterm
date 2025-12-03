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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import java.io.File;
import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for retrieving configuration information regarding LDAP servers.
 */
@Singleton
public class ConfigurationService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationService.class);
    
    /**
     * ObjectMapper for deserializing YAML.
     */
    private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory())
            .registerModule(new SimpleModule().addDeserializer(Pattern.class, new CaseInsensitivePatternDeserializer()));

    /**
     * The name of the file within GUACAMOLE_HOME that defines each available
     * LDAP server (if not using guacamole.properties).
     */
    private static final String LDAP_SERVERS_YML = "ldap-servers.yml";

    /**
     * The timestamp that the {@link #LDAP_SERVERS_YML} was last modified when
     * it was read, as would be returned by {@link File#lastModified()}.
     */
    private final AtomicLong lastModified = new AtomicLong(0);

    /**
     * The cached copy of the configuration read from {@link #LDAP_SERVERS_YML}.
     * If the current set of LDAP servers has not yet been read from the YAML
     * configuration file, or if guacamole.properties is being used instead,
     * this will be null.
     */
    private Collection<JacksonLDAPConfiguration> cachedConfigurations = null;
    
    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Returns the configuration information for all configured LDAP servers.
     * If multiple servers are returned, each should be tried in order until a
     * successful LDAP connection is established.
     *
     * @return
     *     The configurations of all LDAP servers.
     *
     * @throws GuacamoleException
     *     If the configuration information of the LDAP servers cannot be
     *     retrieved due to an error.
     */
    public Collection<? extends LDAPConfiguration> getLDAPConfigurations() throws GuacamoleException {

        // Read/refresh configuration from YAML, if available
        File ldapServers = new File(environment.getGuacamoleHome(), LDAP_SERVERS_YML);
        if (ldapServers.exists()) {

            long oldLastModified = lastModified.get();
            long currentLastModified = ldapServers.lastModified();

            // Update cached copy of YAML if things have changed, ensuring only
            // one concurrent request updates the cache at any given time
            if (currentLastModified > oldLastModified && lastModified.compareAndSet(oldLastModified, currentLastModified)) {
                try {

                    logger.debug("Reading updated LDAP configuration from \"{}\"...", ldapServers);
                    Collection<JacksonLDAPConfiguration> configs = mapper.readValue(ldapServers, new TypeReference<Collection<JacksonLDAPConfiguration>>() {});

                    if (configs != null) {
                        logger.debug("Reading LDAP configuration defaults from guacamole.properties...");
                        LDAPConfiguration defaultConfig = new EnvironmentLDAPConfiguration(environment);
                        configs.forEach((config) -> config.setDefaults(defaultConfig));
                    }
                    else
                        logger.debug("Using only guacamole.properties for "
                                + "LDAP server definitions as \"{}\" is "
                                + "empty.", ldapServers);

                    cachedConfigurations = configs;

                }
                catch (IOException e) {
                    logger.error("\"{}\" could not be read/parsed: {}", ldapServers, e.getMessage());
                }
            }
            else
                logger.debug("Using cached LDAP configuration from \"{}\".", ldapServers);

        }

        // Clear cached YAML if it no longer exists
        else if (cachedConfigurations != null) {
            long oldLastModified = lastModified.get();
            if (lastModified.compareAndSet(oldLastModified, 0)) {
                logger.debug("Clearing cached LDAP configuration from \"{}\" (file no longer exists).", ldapServers);
                cachedConfigurations = null;
            }
        }

        // Use guacamole.properties if not using YAML
        if (cachedConfigurations == null) {
            logger.debug("Reading LDAP configuration from guacamole.properties...");
            return Collections.singletonList(new EnvironmentLDAPConfiguration(environment));
        }

        return cachedConfigurations;

    }

}
