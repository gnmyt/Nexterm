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

package org.apache.guacamole.extension;

import java.util.Set;
import java.util.UUID;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provides a safe wrapper around an AuthenticationProvider subclass, such that
 * authentication attempts can cleanly fail, and errors can be properly logged,
 * even if the AuthenticationProvider cannot be instantiated.
 */
public class AuthenticationProviderFacade implements AuthenticationProvider {

    /**
     * Logger for this class.
     */
    private Logger logger = LoggerFactory.getLogger(AuthenticationProviderFacade.class);

    /**
     * The underlying authentication provider, or null if the authentication
     * provider could not be instantiated.
     */
    private final AuthenticationProvider authProvider;

    /**
     * The set of identifiers of all authentication providers whose internal
     * failures should be tolerated during the authentication process. If the
     * identifier of this authentication provider is within this set, errors
     * during authentication will result in the authentication provider being
     * ignored for that authentication attempt. By default, errors during
     * authentication halt the authentication process entirely.
     */
    private final Set<String> tolerateFailures;

    /**
     * The identifier to provide for the underlying authentication provider if
     * the authentication provider could not be loaded.
     */
    private final String facadeIdentifier = UUID.randomUUID().toString();

    /**
     * Creates a new AuthenticationProviderFacade which delegates all function
     * calls to an instance of the given AuthenticationProvider subclass. If
     * an instance of the given class cannot be created, creation of this
     * facade will still succeed, but its use will result in errors being
     * logged, and all authentication attempts will fail.
     *
     * @param authProviderClass
     *     The AuthenticationProvider subclass to instantiate.
     *
     * @param tolerateFailures
     *     The set of identifiers of all authentication providers whose
     *     internal failures should be tolerated during the authentication
     *     process. If the identifier of this authentication provider is within
     *     this set, errors during authentication will result in the
     *     authentication provider being ignored for that authentication
     *     attempt. By default, errors during authentication halt the
     *     authentication process entirely.
     */
    public AuthenticationProviderFacade(
            Class<? extends AuthenticationProvider> authProviderClass,
            Set<String> tolerateFailures) {
        this.tolerateFailures = tolerateFailures;
        this.authProvider = ProviderFactory.newInstance("authentication provider",
            authProviderClass);
    }

    @Override
    public String getIdentifier() {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("The authentication system could not be loaded. Please check for errors earlier in the logs.");
            return facadeIdentifier;
        }

        // Delegate to underlying auth provider
        return authProvider.getIdentifier();

    }

    @Override
    public Object getResource() throws GuacamoleException {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("The authentication system could not be loaded. Please check for errors earlier in the logs.");
            return null;
        }

        // Delegate to underlying auth provider
        return authProvider.getResource();

    }

    @Override
    public Credentials updateCredentials(Credentials credentials) throws GuacamoleException {

        // Do nothing if underlying auth provider could not be loaded
        if (authProvider == null)
            return credentials;

        // Delegate to underlying auth provider
        return authProvider.updateCredentials(credentials);

    }

    /**
     * Returns whether this authentication provider should tolerate internal
     * failures during the authentication process, allowing other
     * authentication providers to continue operating as if this authentication
     * provider simply is not present.
     *
     * @return
     *     true if this authentication provider should tolerate internal
     *     failures during the authentication process, false otherwise.
     */
    private boolean isFailureTolerated() {
        return tolerateFailures.contains(getIdentifier());
    }

    /**
     * Logs a warning that this authentication provider is being skipped due to
     * an internal error. If debug-level logging is enabled, the full details
     * of the internal error are also logged.
     *
     * @param e
     *     The internal error that occurred which has resulted in this
     *     authentication provider being skipped.
     */
    private void warnAuthProviderSkipped(Throwable e) {

        logger.warn("The \"{}\" authentication provider has been skipped due "
                + "to an internal error. If this is unexpected or you are the "
                + "developer of this authentication provider, you may wish to "
                + "enable debug-level logging: {}",
                getIdentifier(), e.getMessage());

        logger.debug("Authentication provider skipped due to an internal failure.", e);

    }

    /**
     * Logs a warning that the authentication process will be entirely aborted
     * due to an internal error, advising the administrator to set the
     * "skip-if-unavailable" property if error encountered is expected and
     * should be tolerated.
     */
    private void warnAuthAborted() {
        String identifier = getIdentifier();
        logger.warn("The \"{}\" authentication provider has encountered an "
                + "internal error which will halt the authentication "
                + "process. If this is unexpected or you are the developer of "
                + "this authentication provider, you may wish to enable "
                + "debug-level logging. If this is expected and you wish to "
                + "ignore such failures in the future, please set \"{}: {}\" "
                + "within your guacamole.properties.",
                identifier, ExtensionModule.SKIP_IF_UNAVAILABLE.getName(),
                identifier);
    }

    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("Authentication attempt ignored because the relevant "
                    + "authentication provider could not be loaded. Please "
                    + "check for errors earlier in the logs.");
            return null;
        }

        // Delegate to underlying auth provider
        try {
            return authProvider.authenticateUser(credentials);
        }

        // Pass through client exceptions untouched, including credential
        // exceptions, as these are not internal failures
        catch (GuacamoleClientException e) {
            throw e;
        }

        // Pass through all other exceptions (aborting authentication entirely)
        // only if not configured to ignore such failures
        catch (GuacamoleException | RuntimeException | Error e) {

            // Skip using this authentication provider if configured to ignore
            // internal failures during auth
            if (isFailureTolerated()) {
                warnAuthProviderSkipped(e);
                return null;
            }

            warnAuthAborted();
            throw e;

        }

    }

    @Override
    public AuthenticatedUser updateAuthenticatedUser(AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("Reauthentication attempt ignored because the relevant "
                    + "authentication provider could not be loaded. Please "
                    + "check for errors earlier in the logs.");
            return null;
        }

        // Delegate to underlying auth provider
        return authProvider.updateAuthenticatedUser(authenticatedUser, credentials);

    }

    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("User data retrieval attempt ignored because the "
                    + "relevant authentication provider could not be loaded. "
                    + "Please check for errors earlier in the logs.");
            return null;
        }

        // Delegate to underlying auth provider
        try {
            return authProvider.getUserContext(authenticatedUser);
        }

        // Pass through client exceptions untouched, including credential
        // exceptions, as these are not internal failures
        catch (GuacamoleClientException e) {
            throw e;
        }

        // Pass through all other exceptions (aborting authentication entirely)
        // only if not configured to ignore such failures
        catch (GuacamoleException | RuntimeException | Error e) {

            // Skip using this authentication provider if configured to ignore
            // internal failures during auth
            if (isFailureTolerated()) {
                warnAuthProviderSkipped(e);
                return null;
            }

            warnAuthAborted();
            throw e;

        }

    }

    @Override
    public UserContext updateUserContext(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {

        // Ignore auth attempts if no auth provider could be loaded
        if (authProvider == null) {
            logger.warn("User data refresh attempt ignored because the "
                    + "relevant authentication provider could not be loaded. "
                    + "Please check for errors earlier in the logs.");
            return null;
        }

        // Delegate to underlying auth provider
        return authProvider.updateUserContext(context, authenticatedUser, credentials);
        
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {

        // Do nothing if underlying auth provider could not be loaded
        if (authProvider == null)
            return context;

        // Delegate to underlying auth provider
        return authProvider.decorate(context, authenticatedUser, credentials);

    }

    @Override
    public UserContext redecorate(UserContext decorated, UserContext context,
            AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {

        // Do nothing if underlying auth provider could not be loaded
        if (authProvider == null)
            return context;

        // Delegate to underlying auth provider
        return authProvider.redecorate(decorated, context,
                authenticatedUser, credentials);

    }

    @Override
    public void shutdown() {
        if (authProvider != null)
            authProvider.shutdown();
    }

}
