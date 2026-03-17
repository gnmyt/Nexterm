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

package org.apache.guacamole.vault.conf;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.google.inject.Inject;
import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ExecutionException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.FileGuacamoleProperties;
import org.apache.guacamole.properties.GuacamoleProperties;
import org.apache.guacamole.properties.PropertiesGuacamoleProperties;
import org.apache.guacamole.vault.VaultAuthenticationProviderModule;
import org.apache.guacamole.vault.secret.VaultSecretService;

/**
 * Base class for services which retrieve key vault configuration information.
 * A concrete implementation of this class must be defined and bound for key
 * vault support to work.
 *
 * @see VaultAuthenticationProviderModule
 */
public abstract class VaultConfigurationService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    @Inject
    private VaultSecretService secretService;

    /**
     * ObjectMapper for deserializing YAML.
     */
    private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory());

    /**
     * The name of the file containing a YAML mapping of Guacamole parameter
     * token to vault secret name.
     */
    private final String tokenMappingFilename;

    /**
     * The name of the properties file containing Guacamole configuration
     * properties. Unlike guacamole.properties, the values of these properties
     * are read from the vault. Each property is expected to contain a secret
     * name instead of a property value.
     */
    private final String propertiesFilename;

    /**
     * Creates a new VaultConfigurationService which retrieves the token/secret
     * mappings and Guacamole configuration properties from the files with the
     * given names.
     *
     * @param tokenMappingFilename
     *     The name of the YAML file containing the token/secret mapping.
     *
     * @param propertiesFilename
     *     The name of the properties file containing Guacamole configuration
     *     properties whose values are the names of corresponding secrets.
     */
    protected VaultConfigurationService(String tokenMappingFilename,
            String propertiesFilename) {
        this.tokenMappingFilename = tokenMappingFilename;
        this.propertiesFilename = propertiesFilename;
    }

    /**
     * Returns a mapping dictating the name of the secret which maps to each
     * parameter token. In the returned mapping, the value of each entry is the
     * name of the secret to use to populate the value of the parameter token,
     * and the key of each entry is the name of the parameter token which
     * should receive the value of the secret.
     *
     * The name of the secret may contain its own tokens, which will be
     * substituted using values from the given filter. See the definition of
     * VaultUserContext for the names of these tokens and the contexts in which
     * they can be applied to secret names.
     *
     * @return
     *     A mapping dictating the name of the secret which maps to each
     *     parameter token.
     *
     * @throws GuacamoleException
     *     If the YAML file defining the token/secret mapping cannot be read.
     */
    public Map<String, String> getTokenMapping() throws GuacamoleException {

        // Get configuration file from GUACAMOLE_HOME
        File confFile = new File(environment.getGuacamoleHome(), tokenMappingFilename);
        if (!confFile.exists())
            return Collections.emptyMap();

        // Deserialize token mapping from YAML
        try {

            Map<String, String> mapping = mapper.readValue(confFile, new TypeReference<Map<String, String>>() {});
            if (mapping == null)
                return Collections.emptyMap();

            return mapping;

        }

        // Fail if YAML is invalid/unreadable
        catch (IOException e) {
            throw new GuacamoleServerException("Unable to read token mapping "
                    + "configuration file \"" + tokenMappingFilename + "\".", e);
        }

    }

    /**
     * Returns a GuacamoleProperties instance which automatically reads the
     * values of requested properties from the vault. The name of the secret
     * corresponding to a property stored in the vault is defined via the
     * properties filename supplied at construction time.
     *
     * @return
     *     A GuacamoleProperties instance which automatically reads property
     *     values from the vault.
     *
     * @throws GuacamoleException
     *     If the properties file containing the property/secret mappings
     *     exists but cannot be read.
     */
    public GuacamoleProperties getProperties() throws GuacamoleException {

        // Use empty properties if file cannot be found
        File propFile = new File(environment.getGuacamoleHome(), propertiesFilename);
        if (!propFile.exists())
            return new PropertiesGuacamoleProperties(new Properties());

        // Automatically pull properties from vault
        return new FileGuacamoleProperties(propFile) {

            @Override
            public String getProperty(String name) throws GuacamoleException {
                try {

                    String secretName = super.getProperty(name);
                    if (secretName == null)
                        return null;

                    return secretService.getValue(secretName).get();

                }
                catch (InterruptedException | ExecutionException e) {

                    if (e.getCause() instanceof GuacamoleException)
                        throw (GuacamoleException) e;

                    throw new GuacamoleServerException(String.format("Property "
                            + "\"%s\" could not be retrieved from the vault.", name), e);
                }
            }

        };

    }

    /**
     * Return whether Windows domains should be split out from usernames when
     * fetched from the vault.
     *
     * For example: "DOMAIN\\user" or "user@DOMAIN" should both
     * be split into seperate username and domain tokens if this configuration
     * is true. If false, no domain token should be created and the above values
     * should be stored directly in the username token.
     *
     * @return
     *     true if windows domains should be split out from usernames, false
     *     otherwise.
     *
     * @throws GuacamoleException
     *     If the value specified within guacamole.properties cannot be
     *     parsed.
     */
    public abstract boolean getSplitWindowsUsernames() throws GuacamoleException;

    /**
     * Return whether domains should be considered when matching user records
     * that are fetched from the vault.
     *
     * If set to true, the username and domain must both match when matching
     * records from the vault. If false, only the username will be considered.
     *
     * @return
     *     true if both the username and domain should be considered when
     *     matching user records from the vault.
     *
     * @throws GuacamoleException
     *     If the value specified within guacamole.properties cannot be
     *     parsed.
     */
    public abstract boolean getMatchUserRecordsByDomain() throws GuacamoleException;

}
