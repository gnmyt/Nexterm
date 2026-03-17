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

package org.apache.guacamole.rest.auth;

import java.util.ArrayList;
import java.util.List;

import javax.inject.Inject;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleUnauthorizedException;
import org.apache.guacamole.GuacamoleSession;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.credentials.GuacamoleCredentialsException;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.apache.guacamole.net.event.AuthenticationFailureEvent;
import org.apache.guacamole.net.event.AuthenticationRequestReceivedEvent;
import org.apache.guacamole.net.event.AuthenticationSuccessEvent;
import org.apache.guacamole.rest.event.ListenerService;
import org.glassfish.jersey.server.ContainerRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.inject.Singleton;

/**
 * A service for performing authentication checks in REST endpoints.
 */
@Singleton
public class AuthenticationService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

    /**
     * All configured authentication providers which can be used to
     * authenticate users or retrieve data associated with authenticated users.
     */
    @Inject
    private List<AuthenticationProvider> authProviders;

    /**
     * The map of auth tokens to sessions for the REST endpoints.
     */
    @Inject
    private TokenSessionMap tokenSessionMap;

    /**
     * A generator for creating new auth tokens.
     */
    @Inject
    private AuthTokenGenerator authTokenGenerator;

    /**
     * Service for applying or reapplying layers of decoration.
     */
    @Inject
    private DecorationService decorationService;

    /**
     * The service to use to notify registered authentication listeners.
     */
    @Inject
    private ListenerService listenerService;

    /**
     * The name of the HTTP header that may contain the authentication token
     * used by the Guacamole REST API.
     */
    public static final String TOKEN_HEADER_NAME = "Guacamole-Token";

    /**
     * The name of the query parameter that may contain the authentication
     * token used by the Guacamole REST API.
     */
    public static final String TOKEN_PARAMETER_NAME = "token";

    /**
     * Attempts authentication against all AuthenticationProviders, in order,
     * using the provided credentials. The first authentication failure takes
     * priority, but remaining AuthenticationProviders are attempted. If any
     * AuthenticationProvider succeeds, the resulting AuthenticatedUser is
     * returned, and no further AuthenticationProviders are tried.
     *
     * @param credentials
     *     The credentials to use for authentication.
     *
     * @return
     *     The AuthenticatedUser given by the highest-priority
     *     AuthenticationProvider for which the given credentials are valid.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If the given credentials are not valid for any
     *     AuthenticationProvider, or if an error occurs while authenticating
     *     the user.
     */
    private AuthenticatedUser authenticateUser(Credentials credentials)
        throws GuacamoleAuthenticationProcessException {

        AuthenticationProvider failedAuthProvider = null;
        GuacamoleCredentialsException authFailure = null;

        // Attempt authentication against each AuthenticationProvider
        for (AuthenticationProvider authProvider : authProviders) {

            // Attempt authentication
            try {
                AuthenticatedUser authenticatedUser = authProvider.authenticateUser(credentials);
                if (authenticatedUser != null)
                    return authenticatedUser;
            }

            // Insufficient credentials should take precedence
            catch (GuacamoleInsufficientCredentialsException e) {
                if (authFailure == null || authFailure instanceof GuacamoleInvalidCredentialsException) {
                    failedAuthProvider = authProvider;
                    authFailure = e;
                }
            }

            // Catch other credentials exceptions and assign the first one
            catch (GuacamoleCredentialsException e) {
                if (authFailure == null) {
                    failedAuthProvider = authProvider;
                    authFailure = e;
                }
            }

            catch (GuacamoleException | RuntimeException | Error e) {
                throw new GuacamoleAuthenticationProcessException("User "
                        + "authentication was aborted.", authProvider, e);
            }

        }

        throw new GuacamoleAuthenticationProcessException("User authentication "
                + "failed.", failedAuthProvider, authFailure);

    }

    /**
     * Re-authenticates the given AuthenticatedUser against the
     * AuthenticationProvider that originally created it, using the given
     * Credentials.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to re-authenticate.
     *
     * @param credentials
     *     The Credentials to use to re-authenticate the user.
     *
     * @return
     *     A AuthenticatedUser which may have been updated due to re-
     *     authentication.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If an error prevents the user from being re-authenticated.
     */
    private AuthenticatedUser updateAuthenticatedUser(AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Get original AuthenticationProvider
        AuthenticationProvider authProvider = authenticatedUser.getAuthenticationProvider();

        try {

            // Re-authenticate the AuthenticatedUser against the original AuthenticationProvider only
            authenticatedUser = authProvider.updateAuthenticatedUser(authenticatedUser, credentials);
            if (authenticatedUser == null)
                throw new GuacamoleSecurityException("User re-authentication failed.");

            return authenticatedUser;

        }
        catch (GuacamoleException | RuntimeException | Error e) {
            throw new GuacamoleAuthenticationProcessException("User re-authentication failed.", authProvider, e);
        }

    }

    /**
     * Returns the AuthenticatedUser associated with the given session and
     * credentials, performing a fresh authentication and creating a new
     * AuthenticatedUser if necessary.
     *
     * @param existingSession
     *     The current GuacamoleSession, or null if no session exists yet.
     *
     * @param credentials
     *     The Credentials to use to authenticate the user.
     *
     * @return
     *     The AuthenticatedUser associated with the given session and
     *     credentials.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If an error occurs while authenticating or re-authenticating the
     *     user.
     */
    private AuthenticatedUser getAuthenticatedUser(GuacamoleSession existingSession,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Re-authenticate user if session exists
        if (existingSession != null) {
            AuthenticatedUser updatedUser = updateAuthenticatedUser(
                    existingSession.getAuthenticatedUser(), credentials);
            return updatedUser;
        }

        // Otherwise, attempt authentication as a new user
        AuthenticatedUser authenticatedUser = AuthenticationService.this.authenticateUser(credentials);
        return authenticatedUser;

    }

    /**
     * Returns all UserContexts associated with the given AuthenticatedUser,
     * updating existing UserContexts, if any. If no UserContexts are yet
     * associated with the given AuthenticatedUser, new UserContexts are
     * generated by polling each available AuthenticationProvider.
     *
     * @param existingSession
     *     The current GuacamoleSession, or null if no session exists yet.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser that has successfully authenticated or re-
     *     authenticated.
     *
     * @param credentials
     *     The Credentials provided by the user in the most recent
     *     authentication attempt.
     *
     * @return
     *     A List of all UserContexts associated with the given
     *     AuthenticatedUser.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If an error occurs while creating or updating any UserContext.
     */
    private List<DecoratedUserContext> getUserContexts(GuacamoleSession existingSession,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleAuthenticationProcessException {

        List<DecoratedUserContext> userContexts = new ArrayList<>(authProviders.size());

        // If UserContexts already exist, update them and add to the list
        if (existingSession != null) {

            // Update all old user contexts
            List<DecoratedUserContext> oldUserContexts = existingSession.getUserContexts();
            for (DecoratedUserContext userContext : oldUserContexts) {

                UserContext oldUserContext = userContext.getUndecoratedUserContext();

                // Update existing UserContext
                AuthenticationProvider authProvider = oldUserContext.getAuthenticationProvider();
                UserContext updatedUserContext;
                try {
                    updatedUserContext = authProvider.updateUserContext(oldUserContext, authenticatedUser, credentials);
                }
                catch (GuacamoleException | RuntimeException | Error e) {
                    throw new GuacamoleAuthenticationProcessException("User "
                            + "authentication aborted during UserContext update.",
                            authProvider, e);
                }

                // Add to available data, if successful
                if (updatedUserContext != null)
                    userContexts.add(decorationService.redecorate(userContext,
                            updatedUserContext, authenticatedUser, credentials));

                // If unsuccessful, log that this happened, as it may be a bug
                else
                    logger.debug("AuthenticationProvider \"{}\" retroactively destroyed its UserContext.",
                            authProvider.getClass().getName());

            }

        }

        // Otherwise, create new UserContexts from available AuthenticationProviders
        else {

            // Get UserContexts from each available AuthenticationProvider
            for (AuthenticationProvider authProvider : authProviders) {

                // Generate new UserContext
                UserContext userContext;
                try {
                    userContext = authProvider.getUserContext(authenticatedUser);
                }
                catch (GuacamoleException | RuntimeException | Error e) {
                    throw new GuacamoleAuthenticationProcessException("User "
                            + "authentication aborted during initial "
                            + "UserContext creation.", authProvider, e);
                }

                // Add to available data, if successful
                if (userContext != null)
                    userContexts.add(decorationService.decorate(userContext,
                            authenticatedUser, credentials));

            }

        }

        return userContexts;

    }

    /**
     * Authenticates a user using the given credentials and optional
     * authentication token, returning the authentication token associated with
     * the user's Guacamole session, which may be newly generated. If an
     * existing token is provided, the authentication procedure will attempt to
     * update or reuse the provided token, but it is possible that a new token
     * will be returned. Note that this function CANNOT return null.
     *
     * @param credentials
     *     The credentials to use when authenticating the user.
     *
     * @param token
     *     The authentication token to use if attempting to re-authenticate an
     *     existing session, or null to request a new token.
     *
     * @return
     *     The authentication token associated with the newly created or
     *     existing session.
     *
     * @throws GuacamoleException
     *     If the authentication or re-authentication attempt fails.
     */
    public String authenticate(Credentials credentials, String token)
            throws GuacamoleException {

        String authToken;
        try {

            // Allow extensions to make updated to credentials prior to
            // actual authentication (NOTE: We do this here instead of in a
            // separate function to ensure that failure events accurately
            // represent the credentials that failed when a chain of credential
            // updates is involved)
            for (AuthenticationProvider authProvider : authProviders) {
                try {
                    credentials = authProvider.updateCredentials(credentials);
                }
                catch (GuacamoleException | RuntimeException | Error e) {
                    throw new GuacamoleAuthenticationProcessException("User "
                            + "authentication aborted during credential "
                            + "update/revision.", authProvider, e);
                }
            }

            // Fire pre-authentication event before ANY authn/authz occurs at all
            final Credentials updatedCredentials = credentials;
            listenerService.handleEvent((AuthenticationRequestReceivedEvent) () -> updatedCredentials);

            // Pull existing session if token provided
            GuacamoleSession existingSession;
            if (token != null)
                existingSession = tokenSessionMap.get(token);
            else
                existingSession = null;

            // Get up-to-date AuthenticatedUser and associated UserContexts
            AuthenticatedUser authenticatedUser = getAuthenticatedUser(existingSession, updatedCredentials);
            List<DecoratedUserContext> userContexts = getUserContexts(existingSession, authenticatedUser, updatedCredentials);

            // Update existing session, if it exists
            if (existingSession != null) {
                authToken = token;
                existingSession.setAuthenticatedUser(authenticatedUser);
                existingSession.setUserContexts(userContexts);
            }

            // If no existing session, generate a new token/session pair
            else {
                authToken = authTokenGenerator.getToken();
                tokenSessionMap.put(authToken, new GuacamoleSession(listenerService, authenticatedUser, userContexts));
            }

            // Report authentication success
            try {
                listenerService.handleEvent(new AuthenticationSuccessEvent(authenticatedUser,
                        existingSession != null));
            }
            catch (GuacamoleException e) {
                throw new GuacamoleAuthenticationProcessException("User "
                        + "authentication aborted by event listener.", null, e);
            }

        }

        // Log and rethrow any authentication errors
        catch (GuacamoleAuthenticationProcessException e) {

            // NOTE: The credentials referenced here are intentionally NOT the
            // final updatedCredentials reference (though they may often be
            // equivalent) to ensure that failure events accurately represent
            // the credentials that failed if that failure occurs in the middle
            // of a chain of credential updates via updateCredentials()
            listenerService.handleEvent(new AuthenticationFailureEvent(credentials,
                    e.getAuthenticationProvider(), e.getCause()));

            // Rethrow exception
            e.rethrowCause();

            // This line SHOULD be unreachable unless a bug causes
            // rethrowCause() to not actually rethrow the underlying failure
            Throwable cause = e.getCause();
            if (cause != null) {
                logger.warn("An underlying internal error was not correctly rethrown by rethrowCause(): {}", cause.getMessage());
                logger.debug("Internal error not rethrown by rethrowCause().", cause);
            }
            else
                logger.warn("An underlying internal error was not correctly rethrown by rethrowCause().");

            throw e.getCauseAsGuacamoleException();

        }

        return authToken;

    }

    /**
     * Finds the Guacamole session for a given auth token, if the auth token
     * represents a currently logged in user. Throws an unauthorized error
     * otherwise.
     *
     * @param authToken The auth token to check against the map of logged in users.
     * @return The session that corresponds to the provided auth token.
     * @throws GuacamoleException If the auth token does not correspond to any
     *                            logged in user.
     */
    public GuacamoleSession getGuacamoleSession(String authToken) 
            throws GuacamoleException {
        
        // Try to get the session from the map of logged in users.
        GuacamoleSession session = tokenSessionMap.get(authToken);
       
        // Authentication failed.
        if (session == null)
            throw new GuacamoleUnauthorizedException("Permission Denied.");
        
        return session;

    }

    /**
     * Invalidates a specific authentication token and its corresponding
     * Guacamole session, effectively logging out the associated user. If the
     * authentication token is not valid, this function has no effect.
     *
     * @param authToken
     *     The token being invalidated.
     *
     * @return
     *     true if the given authentication token was valid and the
     *     corresponding Guacamole session was destroyed, false if the given
     *     authentication token was not valid and no action was taken.
     */
    public boolean destroyGuacamoleSession(String authToken) {

        // Remove corresponding GuacamoleSession if the token is valid
        GuacamoleSession session = tokenSessionMap.remove(authToken);
        if (session == null)
            return false;

        // Invalidate the removed session
        session.invalidate();
        return true;

    }

    /**
     * Returns all UserContexts associated with a given auth token, if the auth
     * token represents a currently logged in user. Throws an unauthorized
     * error otherwise.
     *
     * @param authToken
     *     The auth token to check against the map of logged in users.
     *
     * @return
     *     A List of all UserContexts associated with the provided auth token.
     *
     * @throws GuacamoleException
     *     If the auth token does not correspond to any logged in user.
     */
    public List<DecoratedUserContext> getUserContexts(String authToken)
            throws GuacamoleException {
        return getGuacamoleSession(authToken).getUserContexts();
    }

    /**
     * Returns the authentication token sent within the given request, if
     * present, or null if otherwise. Authentication tokens may be sent via
     * the "Guacamole-Token" header or the "token" query parameter. If both
     * the header and a parameter are used, the header is given priority.
     *
     * @param request
     *     The HTTP request to retrieve the authentication token from.
     *
     * @return
     *     The authentication token within the given request, or null if no
     *     token is present.
     */
    public String getAuthenticationToken(ContainerRequest request) {

        // Give priority to token within HTTP header
        String token = request.getHeaderString(TOKEN_HEADER_NAME);
        if (token != null && !token.isEmpty())
            return token;

        // If no token was provided via HTTP headers, fall back to using
        // query parameters
        token = request.getUriInfo().getQueryParameters().getFirst(TOKEN_PARAMETER_NAME);
        if (token != null && !token.isEmpty())
            return token;

        return null;

    }

}
