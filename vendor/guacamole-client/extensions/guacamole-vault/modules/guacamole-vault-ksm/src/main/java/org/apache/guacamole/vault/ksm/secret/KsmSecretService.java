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

package org.apache.guacamole.vault.ksm.secret;

import com.google.common.base.Objects;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.keepersecurity.secretsManager.core.KeeperRecord;
import com.keepersecurity.secretsManager.core.SecretsManagerOptions;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Future;

import javax.annotation.Nonnull;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Attributes;
import org.apache.guacamole.net.auth.Connectable;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.token.TokenFilter;
import org.apache.guacamole.vault.ksm.GuacamoleExceptionSupplier;
import org.apache.guacamole.vault.ksm.conf.KsmAttributeService;
import org.apache.guacamole.vault.ksm.conf.KsmConfigurationService;
import org.apache.guacamole.vault.ksm.user.KsmDirectory;
import org.apache.guacamole.vault.secret.VaultSecretService;
import org.apache.guacamole.vault.secret.WindowsUsername;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service which retrieves secrets from Keeper Secrets Manager.
 * The configuration used to connect to KSM can be set at a global
 * level using guacamole.properties, or using a connection group
 * attribute.
 */
@Singleton
public class KsmSecretService implements VaultSecretService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(VaultSecretService.class);

    /**
     * Service for retrieving data from records.
     */
    @Inject
    private KsmRecordService recordService;

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private KsmConfigurationService confService;

    /**
     * Factory for creating KSM client instances.
     */
    @Inject
    private KsmClientFactory ksmClientFactory;

    /**
     * A map of base-64 encoded JSON KSM config blobs to associated KSM client instances.
     * A distinct KSM client will exist for every KSM config.
     */
    private final ConcurrentMap<String, KsmClient> ksmClientMap = new ConcurrentHashMap<>();

    /**
     * Create and return a KSM client for the provided KSM config if not already
     * present in the client map, otherwise return the existing client entry.
     *
     * @param ksmConfig
     *     The base-64 encoded JSON KSM config blob associated with the client entry.
     *     If an associated entry does not already exist, it will be created using
     *     this configuration.
     *
     * @return
     *     A KSM client for the provided KSM config if not already present in the
     *     client map, otherwise the existing client entry.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the KSM client.
     */
    private KsmClient getClient(@Nonnull String ksmConfig)
            throws GuacamoleException {

        // If a client already exists for the provided config, use it
        KsmClient ksmClient = ksmClientMap.get(ksmConfig);
        if (ksmClient != null)
            return ksmClient;

        // Create and store a new KSM client instance for the provided KSM config blob
        SecretsManagerOptions options = confService.getSecretsManagerOptions(ksmConfig);
        ksmClient = ksmClientFactory.create(options, confService.getKsmApiInterval());
        KsmClient prevClient = ksmClientMap.putIfAbsent(ksmConfig, ksmClient);

        // If the client was already set before this thread got there, use the existing one
        return prevClient != null ? prevClient : ksmClient;
    }

    @Override
    public String canonicalize(String nameComponent) {
        try {

            // As Keeper notation is essentially a URL, encode all components
            // using standard URL escaping
            return URLEncoder.encode(nameComponent, "UTF-8");

        }
        catch (UnsupportedEncodingException e) {
            throw new UnsupportedOperationException("Unexpected lack of UTF-8 support.", e);
        }
    }

    @Override
    public Future<String> getValue(UserContext userContext, Connectable connectable,
            String name) throws GuacamoleException {

        // Attempt to find a KSM config for this connection or group
        String ksmConfig = getConnectionGroupKsmConfig(userContext, connectable);

        return getClient(ksmConfig).getSecret(name, new GuacamoleExceptionSupplier<Future<String>>() {

            @Override
            public Future<String> get() throws GuacamoleException {

                // Get the user-supplied KSM config, if allowed by config and
                // set by the user
                String userKsmConfig = getUserKSMConfig(userContext, connectable);

                // If the user config happens to be the same as admin-defined one,
                // don't bother trying again
                if (userKsmConfig != null && !Objects.equal(userKsmConfig, ksmConfig))
                    return getClient(userKsmConfig).getSecret(name);

                return CompletableFuture.completedFuture(null);
            }

        });
    }

    @Override
    public Future<String> getValue(String name) throws GuacamoleException {

        // Use the default KSM configuration from guacamole.properties
        return getClient(confService.getKsmConfig()).getSecret(name);
    }

    /**
     * Adds contextual parameter tokens for the secrets in the given record to
     * the given map of existing tokens. The values of each token are
     * determined from secrets within the record. Depending on the record, this
     * will be a subset of the username, password, private key, and passphrase.
     *
     * @param tokens
     *     The map of parameter tokens that any new tokens should be added to.
     *
     * @param prefix
     *     The prefix that should be prepended to each added token.
     *
     * @param record
     *     The record to retrieve secrets from when generating tokens. This may
     *     be null.
     *
     * @throws GuacamoleException
     *     If configuration details in guacamole.properties cannot be parsed.
     */
    private void addRecordTokens(Map<String, Future<String>> tokens, String prefix,
            KeeperRecord record) throws GuacamoleException {

        if (record == null)
            return;

        // Domain of server-related record
        String domain = recordService.getDomain(record);
        if (domain != null)
            tokens.put(prefix + "DOMAIN", CompletableFuture.completedFuture(domain));

        // Username of server-related record
        String username = recordService.getUsername(record);
        if (username != null) {

            // If the record had no directly defined domain, but there is a
            // username, and the configuration is enabled to split Windows
            // domains out of usernames, attempt to split the domain out now
            if (domain == null && confService.getSplitWindowsUsernames()) {
                WindowsUsername usernameAndDomain =
                        WindowsUsername.splitWindowsUsernameFromDomain(username);

                // Always store the username token
                tokens.put(prefix + "USERNAME", CompletableFuture.completedFuture(
                        usernameAndDomain.getUsername()));

                // Only store the domain if one is detected
                if (usernameAndDomain.hasDomain())
                    tokens.put(prefix + "DOMAIN", CompletableFuture.completedFuture(
                        usernameAndDomain.getDomain()));

            }

            // If splitting is not enabled, store the whole value in the USERNAME token
            else {
                tokens.put(prefix + "USERNAME", CompletableFuture.completedFuture(username));
            }
        }

        // Password of server-related record
        String password = recordService.getPassword(record);
        if (password != null)
            tokens.put(prefix + "PASSWORD", CompletableFuture.completedFuture(password));

        // Key passphrase of server-related record
        String passphrase = recordService.getPassphrase(record);
        if (passphrase != null)
            tokens.put(prefix + "PASSPHRASE", CompletableFuture.completedFuture(passphrase));

        // Private key of server-related record
        Future<String> privateKey = recordService.getPrivateKey(record);
        tokens.put(prefix + "KEY", privateKey);

    }

    /**
     * Search for a KSM configuration attribute, recursing up the connection group tree
     * until a connection group with the appropriate attribute is found. If the KSM config
     * is found, it will be returned. If not, the default value from the config file will
     * be returned.
     *
     * @param userContext
     *     The userContext associated with the connection or connection group.
     *
     * @param connectable
     *     A connection or connection group for which the tokens are being replaced.
     *
     * @return
     *     The value of the KSM configuration attribute if found in the tree, the default
     *     KSM config blob defined in guacamole.properties otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while attempting to retrieve the KSM config attribute, or if
     *     no KSM config is found in the connection group tree, and the value is also not
     *     defined in the config file.
     */
    @Nonnull
    private String getConnectionGroupKsmConfig(
            UserContext userContext, Connectable connectable) throws GuacamoleException {

        // Check to make sure it's a usable type before proceeding
        if (
                !(connectable instanceof Connection)
                && !(connectable instanceof ConnectionGroup)) {
            logger.warn(
                    "Unsupported Connectable type: {}; skipping KSM config lookup.",
                    connectable.getClass());

            // Use the default value if searching is impossible
            return confService.getKsmConfig();
        }

        // For connections, start searching the parent group for the KSM config
        // For connection groups, start searching the group directly
        String parentIdentifier = (connectable instanceof Connection)
                ? ((Connection) connectable).getParentIdentifier()
                : ((ConnectionGroup) connectable).getIdentifier();

        // Keep track of all group identifiers seen while recursing up the tree
        // in case there's a cycle - if the same identifier is ever seen twice,
        // the search is over.
        Set<String> observedIdentifiers = new HashSet<>();
        observedIdentifiers.add(parentIdentifier);

        // Use the unwrapped connection group directory to avoid KSM config
        // value sanitization
        Directory<ConnectionGroup> connectionGroupDirectory = (
                (KsmDirectory<ConnectionGroup>) userContext.getConnectionGroupDirectory()
                ).getUnderlyingDirectory();

        while (true) {

            // Fetch the parent group, if one exists
            ConnectionGroup group = connectionGroupDirectory.get(parentIdentifier);
            if (group == null)
                break;

            // If the current connection group has the KSM configuration attribute
            // set to a non-empty value, return immediately
            String ksmConfig = group.getAttributes().get(KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE);
            if (ksmConfig != null && !ksmConfig.trim().isEmpty())
                return ksmConfig;

            // Otherwise, keep searching up the tree until an appropriate configuration is found
            parentIdentifier = group.getParentIdentifier();

            // If the parent is a group that's already been seen, this is a cycle, so there's no
            // need to search any further
            if (!observedIdentifiers.add(parentIdentifier))
                break;
        }

        // If no KSM configuration was ever found, use the default value
        return confService.getKsmConfig();

    }

    /**
     * Returns true if user-level KSM configuration is enabled for the given
     * Connectable, false otherwise.
     *
     * @param connectable
     *     The connectable to check for whether user-level KSM configs are
     *     enabled.
     *
     * @return
     *     True if user-level KSM configuration is enabled for the given
     *     Connectable, false otherwise.
     */
    private boolean isKsmUserConfigEnabled(Connectable connectable) {

        // User-level config is enabled IFF the appropriate attribute is set to true
        if (connectable instanceof Attributes)
            return KsmAttributeService.TRUTH_VALUE.equals(((Attributes) connectable).getAttributes().get(
                KsmAttributeService.KSM_USER_CONFIG_ENABLED_ATTRIBUTE));

        // If there's no attributes to check, the user config cannot be enabled
        return false;

    }

    /**
     * Return the KSM config blob for the current user IFF user KSM configs
     * are enabled globally, and are enabled for the given connectable. If no
     * KSM config exists for the given user or KSM configs are not enabled,
     * null will be returned.
     *
     * @param userContext
     *    The user context from which the current user should be fetched.
     *
     * @param connectable
     *    The connectable to which the connection is being established. This
     *    is the conneciton which will be checked to see if user KSM configs
     *    are enabled.
     *
     * @return
     *    The base64 encoded KSM config blob for the current user if one
     *    exists, and if user KSM configs are enabled globally and for the
     *    provided connectable.
     *
     * @throws GuacamoleException
     *     If an error occurs while attempting to fetch the KSM config.
     */
    private String getUserKSMConfig(
            UserContext userContext, Connectable connectable) throws GuacamoleException {

        // If user KSM configs are enabled globally, and for the given connectable,
        // return the user-specific KSM config, if one exists
        if (confService.getAllowUserConfig() && isKsmUserConfigEnabled(connectable)) {

            // Get the underlying user, to avoid the KSM config sanitization
            User self = (
                    ((KsmDirectory<User>) userContext.getUserDirectory())
                    .getUnderlyingDirectory().get(userContext.self().getIdentifier()));

            return self.getAttributes().get(
                    KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE);
        }


        // If user-specific KSM config is disabled globally or for the given
        // connectable, return null to indicate that no user config exists
        return null;
    }

    /**
     * Use the provided KSM client to add parameter tokens tokens to the
     * provided token map. The supplied filter will be used to replace
     * existing tokens in the provided connection parameters before KSM
     * record lookup. The supplied GuacamoleConfiguration instance will
     * be used to check the protocol, in case RDP-specific behavior is
     * needed.

     * @param config
     *    The GuacamoleConfiguration associated with the Connectable for which
     *    tokens are being added.
     *
     * @param ksm
     *     The KSM client to use when fetching records.
     *
     * @param tokens
     *     The tokens to which any fetched KSM record values should be added.
     *
     * @param parameters
     *     The connection parameters associated with the Connectable for which
     *     tokens are being added.
     *
     * @throws GuacamoleException
     *     If an error occurs while attempting to fetch KSM records or check
     *     configuration settings.
     */
    private void addConnectableTokens(
            GuacamoleConfiguration config, KsmClient ksm, Map<String, Future<String>> tokens,
            Map<String, String> parameters, TokenFilter filter) throws GuacamoleException {

        // Retrieve and define server-specific tokens, if any
        String hostname = parameters.get("hostname");
        if (hostname != null && !hostname.isEmpty())
            addRecordTokens(tokens, "KEEPER_SERVER_",
                    ksm.getRecordByHost(filter.filter(hostname)));

        // Tokens specific to RDP
        if ("rdp".equals(config.getProtocol())) {

            // Retrieve and define gateway server-specific tokens, if any
            String gatewayHostname = parameters.get("gateway-hostname");
            if (gatewayHostname != null && !gatewayHostname.isEmpty())
                addRecordTokens(tokens, "KEEPER_GATEWAY_",
                        ksm.getRecordByHost(filter.filter(gatewayHostname)));

            // Retrieve and define domain tokens, if any
            String domain = parameters.get("domain");
            String filteredDomain = null;
            if (domain != null && !domain.isEmpty()) {
                filteredDomain = filter.filter(domain);
                addRecordTokens(tokens, "KEEPER_DOMAIN_",
                        ksm.getRecordByDomain(filteredDomain));
            }

            // Retrieve and define gateway domain tokens, if any
            String gatewayDomain = parameters.get("gateway-domain");
            String filteredGatewayDomain = null;
            if (gatewayDomain != null && !gatewayDomain.isEmpty()) {
                filteredGatewayDomain = filter.filter(gatewayDomain);
                addRecordTokens(tokens, "KEEPER_GATEWAY_DOMAIN_",
                        ksm.getRecordByDomain(filteredGatewayDomain));
            }

            // If domain matching is disabled for user records,
            // explicitly set the domains to null when storing
            // user records to enable username-only matching
            if (!confService.getMatchUserRecordsByDomain()) {
                filteredDomain = null;
                filteredGatewayDomain = null;
            }

            // Retrieve and define user-specific tokens, if any
            String username = parameters.get("username");
            if (username != null && !username.isEmpty())
                addRecordTokens(tokens, "KEEPER_USER_",
                        ksm.getRecordByLogin(filter.filter(username),
                        filteredDomain));

            // Retrieve and define gateway user-specific tokens, if any
            String gatewayUsername = parameters.get("gateway-username");
            if (gatewayUsername != null && !gatewayUsername.isEmpty())
                addRecordTokens(tokens, "KEEPER_GATEWAY_USER_",
                        ksm.getRecordByLogin(
                            filter.filter(gatewayUsername),
                            filteredGatewayDomain));
        }

        else {

            // Retrieve and define user-specific tokens, if any
            // NOTE that non-RDP connections do not have a domain
            // field in the connection parameters, so the domain
            // will always be null
            String username = parameters.get("username");
            if (username != null && !username.isEmpty())
                addRecordTokens(tokens, "KEEPER_USER_",
                        ksm.getRecordByLogin(filter.filter(username), null));
        }
    }

    @Override
    public Map<String, Future<String>> getTokens(UserContext userContext, Connectable connectable,
            GuacamoleConfiguration config, TokenFilter filter) throws GuacamoleException {

        Map<String, Future<String>> tokens = new HashMap<>();
        Map<String, String> parameters = config.getParameters();

        // Only use the user-specific KSM config if explicitly enabled in the global
        // configuration, AND for the specific connectable being connected to
        String userKsmConfig = getUserKSMConfig(userContext, connectable);
        if (userKsmConfig != null && !userKsmConfig.trim().isEmpty())
            addConnectableTokens(
                    config, getClient(userKsmConfig), tokens, parameters, filter);

        // Add connection group or globally defined tokens after the user-specific
        // ones to ensure that the user config will be overriden on collision
        String ksmConfig = getConnectionGroupKsmConfig(userContext, connectable);
        addConnectableTokens(
            config, getClient(ksmConfig), tokens, parameters, filter);

        return tokens;

    }

}
