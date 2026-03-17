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

package org.apache.guacamole.auth.jdbc;

import com.google.inject.Inject;
import com.google.inject.Provider;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordMapper;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicyService;
import org.apache.guacamole.auth.jdbc.sharing.user.SharedAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.user.ModeledUser;
import org.apache.guacamole.auth.jdbc.user.ModeledUserContext;
import org.apache.guacamole.auth.jdbc.user.PrivilegedModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.user.UserService;
import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;

/**
 * AuthenticationProviderService implementation which authenticates users with
 * a username/password pair, producing new UserContext objects which are backed
 * by an underlying, arbitrary database.
 */
public class JDBCAuthenticationProviderService implements AuthenticationProviderService  {

    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Service for accessing users.
     */
    @Inject
    private UserService userService;

    /**
     * Service for enforcing password complexity policies.
     */
    @Inject
    private PasswordPolicyService passwordPolicyService;

    /**
     * Provider for retrieving UserContext instances.
     */
    @Inject
    private Provider<ModeledUserContext> userContextProvider;

    /**
     * Mapper for writing connection history.
     */
    @Inject
    private ConnectionRecordMapper connectionRecordMapper;

    @Override
    public AuthenticatedUser authenticateUser(AuthenticationProvider authenticationProvider,
            Credentials credentials) throws GuacamoleException {

        // Authenticate user
        AuthenticatedUser user = userService.retrieveAuthenticatedUser(authenticationProvider, credentials);
        if (user != null)
            return user;

        // Otherwise, unauthorized
        throw new GuacamoleInvalidCredentialsException("Invalid login", CredentialsInfo.USERNAME_PASSWORD);

    }

    @Override
    public ModeledUserContext getUserContext(AuthenticationProvider authenticationProvider,
            AuthenticatedUser authenticatedUser) throws GuacamoleException {

        // Always allow but provide no data for users authenticated via our own
        // connection sharing links
        if (authenticatedUser instanceof SharedAuthenticatedUser)
            return null;

        // Set semantic flags based on context
        boolean databaseCredentialsUsed = (authenticatedUser instanceof ModeledAuthenticatedUser);
        boolean databaseRestrictionsApplicable = (databaseCredentialsUsed || environment.isUserRequired());

        // Retrieve user account for already-authenticated user
        ModeledUser user = userService.retrieveUser(authenticationProvider, authenticatedUser);
        ModeledUserContext context = userContextProvider.get();
        if (user != null && !user.isDisabled()) {

            // Enforce applicable account restrictions
            if (databaseRestrictionsApplicable) {

                // Verify user account is still valid as of today
                if (!user.isAccountValid())
                    throw new TranslatableGuacamoleClientException("User "
                            + "account is no longer valid.",
                            "LOGIN.ERROR_NOT_VALID");

                // Verify user account is allowed to be used at the current time
                if (!user.isAccountAccessible())
                    throw new TranslatableGuacamoleClientException("User "
                            + "account may not be used at this time.",
                            "LOGIN.ERROR_NOT_ACCESSIBLE");

            }

            // Update password if password is expired AND the password was
            // actually involved in the authentication process
            if (databaseCredentialsUsed) {
                if (user.isExpired() || passwordPolicyService.isPasswordExpired(user))
                    userService.resetExpiredPassword(user, authenticatedUser.getCredentials());
            }

        }

        // If no user account is found, and database-specific account
        // restrictions do not apply, get a skeleton user.
        else if (!databaseRestrictionsApplicable) {
            user = userService.retrieveSkeletonUser(authenticationProvider, authenticatedUser);

            // If auto account creation is enabled, add user to DB.
            if (environment.autoCreateAbsentAccounts()) {
                ModeledUser createdUser = userService.createObject(new PrivilegedModeledAuthenticatedUser(user.getCurrentUser()), user);
                user.setModel(createdUser.getModel());
            }

        }

        // Veto authentication result only if database-specific account
        // restrictions apply in this situation
        else
            throw new GuacamoleInvalidCredentialsException("Invalid login",
                    CredentialsInfo.USERNAME_PASSWORD);

        // Initialize the UserContext with the user account and return it.
        context.init(user.getCurrentUser());
        context.recordUserLogin();
        return context;

    }

    @Override
    public UserContext updateUserContext(AuthenticationProvider authenticationProvider,
            UserContext context, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {

        // Refresh the user context
        return getUserContext(authenticationProvider, authenticatedUser);

    }

    @Override
    public UserContext decorateUserContext(AuthenticationProvider authenticationProvider,
            UserContext context, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {

        // Track connection history only for external connections, and only if enabled in the config
        if (environment.trackExternalConnectionHistory() && context.getAuthenticationProvider() != authenticationProvider) {
            return new HistoryTrackingUserContext(context, credentials.getRemoteHostname(), connectionRecordMapper);
        }

        return context;

    }

}
