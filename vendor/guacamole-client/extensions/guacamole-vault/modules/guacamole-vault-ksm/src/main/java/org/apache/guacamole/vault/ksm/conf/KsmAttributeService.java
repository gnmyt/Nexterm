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

package org.apache.guacamole.vault.ksm.conf;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.BooleanField;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.form.TextField;
import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.vault.conf.VaultAttributeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.keepersecurity.secretsManager.core.InMemoryStorage;
import com.keepersecurity.secretsManager.core.SecretsManager;
import com.keepersecurity.secretsManager.core.SecretsManagerOptions;

/**
 * A service that exposes KSM-specific attributes, allowing setting KSM
 * configuration through the admin interface.
 */
@Singleton
public class KsmAttributeService implements VaultAttributeService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(KsmAttributeService.class);

    /**
     * Service for retrieving KSM configuration details.
     */
    @Inject
    private KsmConfigurationService configurationService;

    /**
     * A singleton ObjectMapper for converting a Map to a JSON string when
     * generating a base64-encoded JSON KSM config blob.
     */
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * All expected fields in the KSM configuration JSON blob.
     */
    private static final List<String> EXPECTED_KSM_FIELDS = (
            Collections.unmodifiableList(Arrays.asList(
                    SecretsManager.KEY_HOSTNAME,
                    SecretsManager.KEY_CLIENT_ID,
                    SecretsManager.KEY_PRIVATE_KEY,
                    SecretsManager.KEY_CLIENT_KEY,
                    SecretsManager.KEY_APP_KEY,
                    SecretsManager.KEY_OWNER_PUBLIC_KEY,
                    SecretsManager.KEY_SERVER_PUBIC_KEY_ID
    )));

    /**
     * The name of the attribute which can contain a KSM configuration blob
     * associated with either a connection group or user.
     */
    public static final String KSM_CONFIGURATION_ATTRIBUTE = "ksm-config";

    /**
     * The KSM configuration attribute contains sensitive information, so it
     * should not be exposed through the directory. Instead, if a value is
     * set on the attributes of an object, the following value will be exposed
     * in its place, and correspondingly the underlying value will not be
     * changed if this value is provided to an update call.
     */
    public static final String KSM_ATTRIBUTE_PLACEHOLDER_VALUE = "**********";

    /**
     * All attributes related to configuring the KSM vault on a
     * per-connection-group or per-user basis.
     */
    public static final Form KSM_CONFIGURATION_FORM = new Form("ksm-config",
            Arrays.asList(new TextField(KSM_CONFIGURATION_ATTRIBUTE)));

    /**
     * All KSM-specific attributes for users, connections, or connection groups, organized by form.
     */
    public static final Collection<Form> KSM_ATTRIBUTES =
            Collections.unmodifiableCollection(Arrays.asList(KSM_CONFIGURATION_FORM));

    /**
     * The name of the attribute which can controls whether a KSM user configuration
     * is enabled on a connection-by-connection basis.
     */
    public static final String KSM_USER_CONFIG_ENABLED_ATTRIBUTE = "ksm-user-config-enabled";

    /**
     * The string value used by KSM attributes to represent the boolean value "true".
     */
    public static final String TRUTH_VALUE = "true";

    /**
     * All attributes related to configuring the KSM vault on a per-connection basis.
     */
    public static final Form KSM_CONNECTION_FORM = new Form("ksm-config",
            Arrays.asList(new BooleanField(KSM_USER_CONFIG_ENABLED_ATTRIBUTE, TRUTH_VALUE)));

    /**
     * All KSM-specific attributes for connections, organized by form.
     */
    public static final Collection<Form> KSM_CONNECTION_ATTRIBUTES =
            Collections.unmodifiableCollection(Arrays.asList(KSM_CONNECTION_FORM));

    @Override
    public Collection<Form> getConnectionAttributes() {
        return KSM_CONNECTION_ATTRIBUTES;
    }

    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        return KSM_ATTRIBUTES;
    }

    @Override
    public Collection<Form> getUserAttributes() {

        try {

            // Expose the user attributes IFF user-level KSM configuration is enabled
            return configurationService.getAllowUserConfig() ? KSM_ATTRIBUTES : Collections.emptyList();

        }

        catch (GuacamoleException e) {

            logger.warn(
                    "Unable to determine if KSM user attributes "
                    + "should be exposed due to config parsing error: {}.", e.getMessage());
            logger.debug(
                    "Config parsing error prevented checking user attribute configuration",
                    e);

            // If the configuration can't be parsed, default to not exposing the attributes
            return Collections.emptyList();
        }

    }

    @Override
    public Collection<Form> getUserPreferenceAttributes() {

        // KSM-specific user preference attributes have the same semantics as
        // user attributes
        return getUserAttributes();
    }

    /**
     * Sanitize the value of the provided KSM config attribute. If the provided
     * config value is non-empty, it will be replaced with the placeholder
     * value to avoid leaking sensitive information. If the value is empty, it
     * will be replaced by `null`.
     *
     * @param ksmAttributeValue
     *    The KSM configuration attribute value to sanitize.
     *
     * @return
     *    The sanitized KSM configuration attribute value, stripped of any
     *    sensitive information.
     */
    public static String sanitizeKsmAttributeValue(String ksmAttributeValue) {

        // Any non-empty values may contain sensitive information, and should
        // be replaced by the safe placeholder value
        if (ksmAttributeValue != null && !ksmAttributeValue.trim().isEmpty())
            return KSM_ATTRIBUTE_PLACEHOLDER_VALUE;

        // If the configuration value is empty, expose a null value
        else
            return null;

    }

    /**
     * Return true if the provided input is a valid base64-encoded string,
     * false otherwise.
     *
     * @param input
     *     The string to check if base-64 encoded.
     *
     * @return
     *     true if the provided input is a valid base64-encoded string,
     *     false otherwise.
     */
    private static boolean isBase64(String input) {

        try {
            Base64.getDecoder().decode(input);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Given a map of attribute values, check for the presence of the
     * KSM_CONFIGURATION_ATTRIBUTE attribute. If it's set, check if it's a valid
     * KSM one-time token. If so, attempt to translate it to a base-64-encoded
     * json KSM config blob. If it's already a KSM config blob, validate it as
     * config blob. If either validation fails, a GuacamoleException will be thrown.
     * The processed attribute values will be returned.
     *
     * @param attributes
     *     The attributes for which the KSM configuration attribute
     *     parsing/validation should be performed.
     *
     * @throws GuacamoleException
     *     If the KSM_CONFIGURATION_ATTRIBUTE is set, but fails to validate as
     *     either a KSM one-time-token, or a KSM base64-encoded JSON config blob.
     */
    public Map<String, String> processAttributes(
            Map<String, String> attributes) throws GuacamoleException {

        // Get the value of the KSM config attribute in the provided map
        String ksmConfigValue = attributes.get(
                KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE);

        // If the placeholder value was provided, do not update the attribute
        if (KsmAttributeService.KSM_ATTRIBUTE_PLACEHOLDER_VALUE.equals(ksmConfigValue)) {

            // Remove the attribute from the map so it won't be updated
            attributes = new HashMap<>(attributes);
            attributes.remove(KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE);

        }

        // Check if the attribute is set to a non-empty value
        else if (ksmConfigValue != null && !ksmConfigValue.trim().isEmpty()) {

            // If it's already base64-encoded, it's a KSM configuration blob,
            // so validate it immediately
            if (isBase64(ksmConfigValue)) {

                // Attempt to validate the config as a base64-econded KSM config blob
                try {
                    KsmConfig.parseKsmConfig(ksmConfigValue);

                    // If it validates, the entity can be left alone - it's already valid
                    return attributes;
                }

                catch (GuacamoleException exception) {

                    // If the parsing attempt fails, throw a translatable error for display
                    // on the frontend
                    throw new TranslatableGuacamoleClientException(
                            "Invalid base64-encoded JSON KSM config provided for "
                            + KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE + " attribute",
                            "CONNECTION_GROUP_ATTRIBUTES.ERROR_INVALID_KSM_CONFIG_BLOB",
                            exception);
                }
            }

            // It wasn't a valid base64-encoded string, it should be a one-time token, so
            // attempt to validat it as such, and if valid, update the attribute to the
            // base64 config blob generated by the token
            try {

                // Create an initially empty storage to be populated using the one-time token
                InMemoryStorage storage = new InMemoryStorage();

                // Populate the in-memory storage using the one-time-token
                SecretsManager.initializeStorage(storage, ksmConfigValue, null);

                // Create an options object using the values we extracted from the one-time token
                SecretsManagerOptions options = new SecretsManagerOptions(
                    storage, null,
                    configurationService.getAllowUnverifiedCertificate());

                // Attempt to fetch secrets using the options we created. This will both validate
                // that the configuration works, and potentially populate missing fields that the
                // initializeStorage() call did not set.
                SecretsManager.getSecrets(options);

                // Create a map to store the extracted values from the KSM storage
                Map<String, String> configMap = new HashMap<>();

                // Go through all the expected fields, extract from the KSM storage,
                // and write to the newly created map
                EXPECTED_KSM_FIELDS.forEach(configKey -> {

                    // Only write the value into the new map if non-null
                    String value = storage.getString(configKey);
                    if (value != null)
                        configMap.put(configKey, value);

                });

                // JSON-encode the value, and then base64 encode that to get the format
                // that KSM would expect
                String jsonString = objectMapper.writeValueAsString(configMap);
                String base64EncodedJson = Base64.getEncoder().encodeToString(
                        jsonString.getBytes(StandardCharsets.UTF_8));

                // Finally, try to parse the newly generated token as a KSM config. If this
                // works, the config should be fully functional
                KsmConfig.parseKsmConfig(base64EncodedJson);

                // Make a copy of the existing attributes, modifying just the value for
                // KSM_CONFIGURATION_ATTRIBUTE
                attributes = new HashMap<>(attributes);
                attributes.put(
                        KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE, base64EncodedJson);

            }

            // The KSM SDK only throws raw Exceptions, so we can't be more specific
            catch (Exception exception) {

                // If the parsing attempt fails, throw a translatable error for display
                // on the frontend
                throw new TranslatableGuacamoleClientException(
                        "Invalid one-time KSM token provided for "
                        + KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE + " attribute",
                        "CONNECTION_GROUP_ATTRIBUTES.ERROR_INVALID_KSM_ONE_TIME_TOKEN",
                        exception);
            }
        }

        return attributes;

    }


}
