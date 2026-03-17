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

package org.apache.guacamole.vault.user;

import com.google.inject.Inject;
import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.Connectable;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.TokenInjectingUserContext;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.token.GuacamoleTokenUndefinedException;
import org.apache.guacamole.token.TokenFilter;
import org.apache.guacamole.vault.conf.VaultAttributeService;
import org.apache.guacamole.vault.conf.VaultConfigurationService;
import org.apache.guacamole.vault.secret.VaultSecretService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * UserContext implementation which automatically injects tokens containing the
 * values of secrets retrieved from a vault.
 */
public class VaultUserContext extends TokenInjectingUserContext {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(VaultUserContext.class);

    /**
     * The name of the token which will be replaced with the username of the
     * current user if specified within the name of a secret. Unlike the
     * standard GUAC_USERNAME token, the username stored with the object
     * representing the user is used here, not necessarily the username
     * provided during authentication. This token applies to both connections
     * and connection groups.
     */
    private static final String USERNAME_TOKEN = "USERNAME";

    /**
     * The name of the token which will be replaced with the name of the
     * current connection group if specified within the name of a secret. This
     * token only applies only to connection groups.
     */
    private static final String CONNECTION_GROUP_NAME_TOKEN = "CONNECTION_GROUP_NAME";

    /**
     * The name of the token which will be replaced with the identifier of the
     * current connection group if specified within the name of a secret. This
     * token only applies only to connection groups.
     */
    private static final String CONNECTION_GROUP_IDENTIFIER_TOKEN = "CONNECTION_GROUP_ID";

    /**
     * The name of the token which will be replaced with the \"hostname\"
     * connection parameter of the current connection if specified within the
     * name of a secret. If the \"hostname\" parameter cannot be retrieved, or
     * if the parameter is blank, the token will not be replaced and any
     * secrets involving that token will not be retrieved. This token only
     * applies only to connections.
     */
    private static final String CONNECTION_HOSTNAME_TOKEN = "CONNECTION_HOSTNAME";

    /**
     * The name of the token which will be replaced with the \"username\"
     * connection parameter of the current connection if specified within the
     * name of a secret. If the \"username\" parameter cannot be retrieved, or
     * if the parameter is blank, the token will not be replaced and any
     * secrets involving that token will not be retrieved. This token only
     * applies only to connections.
     */
    private static final String CONNECTION_USERNAME_TOKEN = "CONNECTION_USERNAME";

    /**
     * The name of the token which will be replaced with the name of the
     * current connection if specified within the name of a secret. This token
     * only applies only to connections.
     */
    private static final String CONNECTION_NAME_TOKEN = "CONNECTION_NAME";

    /**
     * The name of the token which will be replaced with the identifier of the
     * current connection if specified within the name of a secret. This token
     * only applies only to connections.
     */
    private static final String CONNECTION_IDENTIFIER_TOKEN = "CONNECTION_ID";

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private VaultConfigurationService confService;

    /**
     * Service for retrieving the values of secrets stored in a vault.
     */
    @Inject
    private VaultSecretService secretService;

    /**
     * Service for retrieving any custom attributes defined for the
     * current vault implementation.
     */
    @Inject
    private VaultAttributeService attributeService;

    /**
     * Service for modifying any underlying directories for the current
     * vault implementation.
     */
    @Inject
    private VaultDirectoryService directoryService;

    /**
     * Creates a new VaultUserContext which automatically injects tokens
     * containing values of secrets retrieved from a vault. The given
     * UserContext is decorated such that connections and connection groups
     * will receive additional tokens during the connection process.
     *
     * Note that this class depends on concrete implementations of the
     * following classes to be provided via dependency injection:
     *
     *     - VaultConfigurationService
     *     - VaultSecretService
     *
     * Bindings providing these concrete implementations will need to be
     * provided by subclasses of VaultAuthenticationProviderModule for each
     * supported vault.
     *
     * @param userContext
     *     The UserContext instance to decorate.
     */
    @AssistedInject
    public VaultUserContext(@Assisted UserContext userContext) {
        super(userContext);
    }

    /**
     * Creates a new TokenFilter instance with token values set for all tokens
     * which are not specific to connections or connection groups. Currently,
     * this is only the vault-specific username token ("USERNAME"). Each token
     * stored within the returned TokenFilter via setToken() will be
     * automatically canonicalized for use within secret names.
     *
     * @return
     *     A new TokenFilter instance with token values set for all tokens
     *     which are not specific to connections or connection groups.
     */
    private TokenFilter createFilter() {

        // Create filter that automatically canonicalizes all token values
        TokenFilter filter = new TokenFilter() {

            @Override
            public void setToken(String name, String value) {
                super.setToken(name, secretService.canonicalize(value));
            }

            @Override
            public void setTokens(Map<String, String> tokens) {
                tokens.entrySet().forEach((entry) -> setToken(entry.getKey(), entry.getValue()));
            }

        };

        filter.setToken(USERNAME_TOKEN, self().getIdentifier());
        return filter;
    }

    /**
     * Initiates asynchronous retrieval of all applicable tokens and
     * corresponding values from the vault, using the given TokenFilter to
     * filter tokens within the secret names prior to retrieving those secrets.
     *
     * @param connectable
     *     The connection or connection group to which the connection is being
     *     established.
     *
     * @param tokenMapping
     *     The mapping dictating the name of the secret which maps to each
     *     parameter token, where the key is the name of the parameter token
     *     and the value is the name of the secret. The name of the secret
     *     may contain its own tokens, which will be substituted using values
     *     from the given filter.
     *
     * @param secretNameFilter
     *     The filter to use to substitute values for tokens in the names of
     *     secrets to be retrieved from the vault.
     *
     * @param config
     *     The GuacamoleConfiguration of the connection for which tokens are
     *     being retrieved, if available. This may be null.
     *
     * @param configFilter
     *     A TokenFilter instance that applies any tokens already available to
     *     be applied to the configuration of the Guacamole connection. These
     *     tokens will consist of tokens already supplied to connect().
     *
     * @return
     *     A Map of token name to Future, where each Future represents the
     *     pending retrieval operation which will ultimately be completed with
     *     the value of all secrets mapped to that token.
     *
     * @throws GuacamoleException
     *     If the value for any applicable secret cannot be retrieved from the
     *     vault due to an error.
     */
    private Map<String, Future<String>> getTokens(
            Connectable connectable, Map<String, String> tokenMapping,
            TokenFilter secretNameFilter, GuacamoleConfiguration config,
            TokenFilter configFilter) throws GuacamoleException {

        // Populate map with pending secret retrieval operations corresponding
        // to each mapped token
        Map<String, Future<String>> pendingTokens = new HashMap<>(tokenMapping.size());
        for (Map.Entry<String, String> entry : tokenMapping.entrySet()) {

            // Translate secret pattern into secret name, ignoring any
            // secrets which cannot be translated
            String secretName;
            try {
                secretName = secretNameFilter.filterStrict(entry.getValue());
            }
            catch (GuacamoleTokenUndefinedException e) {
                logger.debug("Secret for token \"{}\" will not be retrieved. "
                        + "Token \"{}\" within mapped secret name has no "
                        + "defined value in the current context.",
                        entry.getKey(), e.getTokenName());
                continue;
            }

            // Initiate asynchronous retrieval of the token value
            String tokenName = entry.getKey();
            Future<String> secret = secretService.getValue(
                    this, connectable, secretName);
            pendingTokens.put(tokenName, secret);

        }

        // Additionally include any dynamic, parameter-based tokens
        pendingTokens.putAll(secretService.getTokens(
                this, connectable, config, configFilter));

        return pendingTokens;

    }

    /**
     * Waits for all pending secret retrieval operations to complete,
     * transforming each Future within the given Map into its contained String
     * value.
     *
     * @param pendingTokens
     *     A Map of token name to Future, where each Future represents the
     *     pending retrieval operation which will ultimately be completed with
     *     the value of all secrets mapped to that token.
     *
     * @return
     *     A Map of token name to the corresponding String value retrieved for
     *     that token from the vault.
     *
     * @throws GuacamoleException
     *     If the value for any applicable secret cannot be retrieved from the
     *     vault due to an error.
     */
    private Map<String, String> resolve(Map<String,
            Future<String>> pendingTokens) throws GuacamoleException {

        // Populate map with tokens containing the values of their
        // corresponding secrets
        Map<String, String> tokens = new HashMap<>(pendingTokens.size());
        for (Map.Entry<String, Future<String>> entry : pendingTokens.entrySet()) {

            // Complete secret retrieval operation, blocking if necessary
            String secretValue;
            try {
                secretValue = entry.getValue().get();
            }
            catch (InterruptedException | ExecutionException e) {
                throw new GuacamoleServerException("Retrieval of secret value "
                        + "failed.", e);
            }

            // If a value is defined for the secret in question, store that
            // value under the mapped token
            String tokenName = entry.getKey();
            if (secretValue != null) {
                tokens.put(tokenName, secretValue);
                logger.debug("Token \"{}\" populated with value from "
                        + "secret.", tokenName);
            }
            else
                logger.debug("Token \"{}\" not populated. Mapped "
                        + "secret has no value.", tokenName);

        }

        return tokens;

    }

    @Override
    protected void addTokens(ConnectionGroup connectionGroup,
            Map<String, String> tokens) throws GuacamoleException {

        String name = connectionGroup.getName();
        String identifier = connectionGroup.getIdentifier();
        logger.debug("Injecting tokens from vault for connection group "
                + "\"{}\" (\"{}\").", identifier, name);

        // Add general and connection-group-specific tokens
        TokenFilter filter = createFilter();
        filter.setToken(CONNECTION_GROUP_NAME_TOKEN, name);
        filter.setToken(CONNECTION_GROUP_IDENTIFIER_TOKEN, identifier);

        // Substitute tokens producing secret names, retrieving and storing
        // those secrets as parameter tokens
        tokens.putAll(resolve(getTokens(
                connectionGroup, confService.getTokenMapping(), filter,
                null, new TokenFilter(tokens))));

    }

    /**
     * Retrieves the GuacamoleConfiguration of the given Connection. If
     * possible, privileged access to the configuration is obtained first. Note
     * that the underlying extension is not required to allow privileged
     * access, nor is it required to expose the underlying configuration at
     * all.
     *
     * @param connection
     *     The connection to retrieve the configuration from.
     *
     * @return
     *     The GuacamoleConfiguration associated with the given connection,
     *     which may be partial or empty.
     *
     * @throws GuacamoleException
     *     If an error prevents privileged retrieval of the configuration.
     */
    private GuacamoleConfiguration getConnectionConfiguration(Connection connection)
            throws GuacamoleException {

        String identifier = connection.getIdentifier();

        // Obtain privileged access to parameters if possible (note that the
        // UserContext returned by getPrivileged() is not guaranteed to
        // actually be privileged)
        Connection privilegedConnection = getPrivileged().getConnectionDirectory().get(identifier);
        if (privilegedConnection != null)
            return privilegedConnection.getConfiguration();

        // Fall back to unprivileged access if not implemented/allowed by
        // extension
        return connection.getConfiguration();

    }

    @Override
    protected void addTokens(Connection connection, Map<String, String> tokens)
            throws GuacamoleException {

        String name = connection.getName();
        String identifier = connection.getIdentifier();
        logger.debug("Injecting tokens from vault for connection \"{}\" "
                + "(\"{}\").", identifier, name);

        // Add general and connection-specific tokens
        TokenFilter filter = createFilter();
        filter.setToken(CONNECTION_NAME_TOKEN, connection.getName());
        filter.setToken(CONNECTION_IDENTIFIER_TOKEN, identifier);
        // Add hostname and username tokens if available (implementations are
        // not required to expose connection configuration details)

        GuacamoleConfiguration config = getConnectionConfiguration(connection);
        Map<String, String> parameters = config.getParameters();

        String hostname = parameters.get("hostname");
        if (hostname != null && !hostname.isEmpty())
            filter.setToken(CONNECTION_HOSTNAME_TOKEN, hostname);
        else
            logger.debug("Hostname for connection \"{}\" (\"{}\") not "
                    + "available. \"{}\" token will not be populated in "
                    + "secret names.", identifier, name,
                    CONNECTION_HOSTNAME_TOKEN);

        String username = parameters.get("username");
        if (username != null && !username.isEmpty())
            filter.setToken(CONNECTION_USERNAME_TOKEN, username);
        else
            logger.debug("Username for connection \"{}\" (\"{}\") not "
                    + "available. \"{}\" token will not be populated in "
                    + "secret names.", identifier, name,
                    CONNECTION_USERNAME_TOKEN);

        // Substitute tokens producing secret names, retrieving and storing
        // those secrets as parameter tokens
        tokens.putAll(resolve(getTokens(connection, confService.getTokenMapping(),
                filter, config, new TokenFilter(tokens))));

    }

    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getUserDirectory(super.getUserDirectory());
    }

    @Override
    public Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getUserGroupDirectory(super.getUserGroupDirectory());
    }

    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getConnectionDirectory(super.getConnectionDirectory());
    }

    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getConnectionGroupDirectory(super.getConnectionGroupDirectory());
    }

    @Override
    public Directory<ActiveConnection> getActiveConnectionDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getActiveConnectionDirectory(super.getActiveConnectionDirectory());
    }

    @Override
    public Directory<SharingProfile> getSharingProfileDirectory() throws GuacamoleException {

        // Defer to the vault-specific directory service
        return directoryService.getSharingProfileDirectory(super.getSharingProfileDirectory());

    }

    @Override
    public Collection<Form> getUserAttributes() {

        // Add any custom attributes to any previously defined attributes
        return Collections.unmodifiableCollection(Stream.concat(
                super.getUserAttributes().stream(),
                attributeService.getUserAttributes().stream()
        ).collect(Collectors.toList()));

    }

    @Override
    public Collection<Form> getUserPreferenceAttributes() {

        // Add any custom preference attributes to any previously defined attributes
        return Collections.unmodifiableCollection(Stream.concat(
                super.getUserPreferenceAttributes().stream(),
                attributeService.getUserPreferenceAttributes().stream()
        ).collect(Collectors.toList()));

    }

    @Override
    public Collection<Form> getConnectionAttributes() {

        // Add any custom attributes to any previously defined attributes
        return Collections.unmodifiableCollection(Stream.concat(
                super.getConnectionAttributes().stream(),
                attributeService.getConnectionAttributes().stream()
        ).collect(Collectors.toList()));

    }

    @Override
    public Collection<Form> getConnectionGroupAttributes() {

        // Add any custom attributes to any previously defined attributes
        return Collections.unmodifiableCollection(Stream.concat(
                super.getConnectionGroupAttributes().stream(),
                attributeService.getConnectionGroupAttributes().stream()
        ).collect(Collectors.toList()));

    }

}
