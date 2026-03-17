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

package org.apache.guacamole.auth.totp.user;

import com.google.common.io.BaseEncoding;
import com.google.inject.Inject;
import com.google.inject.Provider;
import inet.ipaddr.IPAddress;
import inet.ipaddr.IPAddressString;
import java.security.InvalidKeyException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.auth.totp.conf.ConfigurationService;
import org.apache.guacamole.auth.totp.form.AuthenticationCodeField;
import org.apache.guacamole.auth.totp.usergroup.TOTPUserGroup;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.language.TranslatableGuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.properties.IPAddressListProperty;
import org.apache.guacamole.totp.TOTPGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for verifying the identity of a user using TOTP.
 */
public class UserVerificationService {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(UserVerificationService.class);

    /**
     * BaseEncoding instance which decoded/encodes base32.
     */
    private static final BaseEncoding BASE32 = BaseEncoding.base32();

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Service for tracking whether TOTP codes have been used.
     */
    @Inject
    private CodeUsageTrackingService codeService;

    /**
     * Provider for AuthenticationCodeField instances.
     */
    @Inject
    private Provider<AuthenticationCodeField> codeFieldProvider;

    /**
     * Retrieves and decodes the base32-encoded TOTP key associated with user
     * having the given UserContext. If no TOTP key is associated with the user,
     * a random key is generated and associated with the user. If the extension
     * storing the user does not support storage of the TOTP key, null is
     * returned.
     *
     * @param context
     *     The UserContext of the user whose TOTP key should be retrieved.
     *
     * @param username
     *     The username of the user associated with the given UserContext.
     *
     * @return
     *     The TOTP key associated with the user having the given UserContext,
     *     or null if the extension storing the user does not support storage
     *     of the TOTP key.
     *
     * @throws GuacamoleException
     *     If a new key is generated, but the extension storing the associated
     *     user fails while updating the user account.
     */
    private UserTOTPKey getKey(UserContext context,
            String username) throws GuacamoleException {

        // Retrieve attributes from current user
        User self = context.self();
        Map<String, String> attributes = context.self().getAttributes();

        // If no key is defined, attempt to generate a new key
        String secret = attributes.get(TOTPUser.TOTP_KEY_SECRET_ATTRIBUTE_NAME);
        
        if (secret == null || secret.isEmpty()) 
            return generateKey(context, username);

        // Parse retrieved base32 key value
        byte[] key;
        try {
            key = BASE32.decode(secret);
        }

        // If key is not valid base32, warn but otherwise pretend the key does
        // not exist
        catch (IllegalArgumentException e) {
            logger.warn("TOTP key of user \"{}\" is not valid base32.", self.getIdentifier());
            logger.debug("TOTP key is not valid base32.", e);
            return null;
        }

        // Otherwise, parse value from attributes
        boolean confirmed = "true".equals(attributes.get(TOTPUser.TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME));
        return new UserTOTPKey(username, key, confirmed);

    }
    
    /**
     * Generate and set a new key for the specified user and context, returning
     * the key if the set successfully or null if it fails.
     * 
     * @param context
     *     The UserContext of the user whose TOTP key should be generated and set.
     *
     * @param username
     *     The username of the user associated with the given UserContext.
     * 
     * @return
     *     The generated and set key, or null if the operation failed.
     * 
     * @throws GuacamoleException
     *     If a new key is generated, but the extension storing the associated
     *     user fails while updating the user account, or if the configuration
     *     cannot be retrieved.
     */
    private UserTOTPKey generateKey(UserContext context, String username)
            throws GuacamoleException {
        
        // Generate random key for user
        TOTPGenerator.Mode mode = confService.getMode();
        UserTOTPKey generated = new UserTOTPKey(username,mode.getRecommendedKeyLength());
        if (setKey(context, generated))
            return generated;

        // Fail if key cannot be set
        return null;
        
    }

    /**
     * Attempts to store the given TOTP key within the user account of the user
     * having the given UserContext. As not all extensions will support storage
     * of arbitrary attributes, this operation may fail.
     *
     * @param context
     *     The UserContext associated with the user whose TOTP key is to be
     *     stored.
     *
     * @param key
     *     The TOTP key to store.
     *
     * @return
     *     true if the TOTP key was successfully stored, false if the extension
     *     handling storage does not support storage of the key.
     *
     * @throws GuacamoleException
     *     If the extension handling storage fails internally while attempting
     *     to update the user.
     */
    private boolean setKey(UserContext context, UserTOTPKey key)
            throws GuacamoleException {

        // Get mutable set of attributes
        User self = context.self();
        Map<String, String> attributes = new HashMap<>();

        // Set/overwrite current TOTP key state
        attributes.put(TOTPUser.TOTP_KEY_SECRET_ATTRIBUTE_NAME, BASE32.encode(key.getSecret()));
        attributes.put(TOTPUser.TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME, key.isConfirmed() ? "true" : "false");
        self.setAttributes(attributes);

        // Confirm that attributes have actually been set
        Map<String, String> setAttributes = self.getAttributes();
        if (!setAttributes.containsKey(TOTPUser.TOTP_KEY_SECRET_ATTRIBUTE_NAME)
                || !setAttributes.containsKey(TOTPUser.TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME))
            return false;

        // Update user object
        try {
            context.getPrivileged().getUserDirectory().update(self);
        }
        catch (GuacamoleSecurityException e) {
            logger.info("User \"{}\" cannot store their TOTP key as they "
                    + "lack permission to update their own account and the "
                    + "TOTP extension was unable to obtain privileged access. "
                    + "TOTP will be disabled for this user.",
                    self.getIdentifier());
            logger.debug("Permission denied to set TOTP key of user "
                    + "account.", e);
            return false;
        }
        catch (GuacamoleUnsupportedException e) {
            logger.debug("Extension storage for user is explicitly read-only. "
                    + "Cannot update attributes to store TOTP key.", e);
            return false;
        }

        // TOTP key successfully stored/updated
        return true;

    }
    
    /**
     * Checks the user in question, via both UserContext and AuthenticatedUser,
     * to see if TOTP has been disabled for this user, either directly or via
     * membership in a group that has had TOTP marked as disabled.
     * 
     * @param context
     *     The UserContext for the user being verified.
     * 
     * @param authenticatedUser
     *     The AuthenticatedUser for the user being verified.
     * 
     * @return
     *     True if TOTP access has been disabled for the user, otherwise
     *     false.
     * 
     * @throws GuacamoleException
     *     If the extension handling storage fails internally while attempting
     *     to update the user.
     */
    private boolean totpDisabled(UserContext context,
            AuthenticatedUser authenticatedUser)
            throws GuacamoleException {
        
        // If TOTP is disabled for this user, return, allowing login to continue
        Map<String, String> myAttributes = context.self().getAttributes();
        if (myAttributes != null
                && TOTPUser.TRUTH_VALUE.equals(myAttributes.get(TOTPUser.TOTP_KEY_DISABLED_ATTRIBUTE_NAME))) {

            logger.warn("TOTP validation has been disabled for user \"{}\"",
                    context.self().getIdentifier());
            return true;

        }
        
        // Check if any effective user groups have TOTP marked as disabled
        Set<String> userGroups = authenticatedUser.getEffectiveUserGroups();
        Directory<UserGroup> directoryGroups = context.getPrivileged().getUserGroupDirectory();
        for (String userGroup : userGroups) {
            UserGroup thisGroup = directoryGroups.get(userGroup);
            if (thisGroup == null)
                continue;
            
            Map<String, String> grpAttributes = thisGroup.getAttributes();
            if (grpAttributes != null 
                    && TOTPUserGroup.TRUTH_VALUE.equals(grpAttributes.get(TOTPUserGroup.TOTP_KEY_DISABLED_ATTRIBUTE_NAME))) {

                logger.warn("TOTP validation will be bypassed for user \"{}\""
                            + " because it has been disabled for group \"{}\"",
                            context.self().getIdentifier(), userGroup);
                return true;

            }
        }
        
        // TOTP has not been disabled
        return false;
        
    }

    /**
     * Verifies the identity of the given user using TOTP. If a authentication
     * code from the user's TOTP device has not already been provided, a code is
     * requested in the form of additional expected credentials. Any provided
     * code is cryptographically verified. If no code is present, or the
     * received code is invalid, an exception is thrown.
     *
     * @param context
     *     The UserContext provided for the user by another authentication
     *     extension.
     *
     * @param authenticatedUser
     *     The user whose identity should be verified using TOTP.
     *
     * @throws GuacamoleException
     *     If required TOTP-specific configuration options are missing or
     *     malformed, or if the user's identity cannot be verified.
     */
    public void verifyIdentity(UserContext context,
            AuthenticatedUser authenticatedUser) throws GuacamoleException {

        // Pull the original HTTP request used to authenticate
        Credentials credentials = authenticatedUser.getCredentials();
        
        // Get the current client address
        IPAddress clientAddr = new IPAddressString(credentials.getRemoteAddress()).getAddress();

        // Ignore anonymous users
        if (authenticatedUser.getIdentifier().equals(AuthenticatedUser.ANONYMOUS_IDENTIFIER))
            return;
        
        // Pull address lists to check from configuration. Note that the enforce
        // list will override the bypass list, which means that, if the client
        // address happens to be in both lists, Duo MFA will be enforced.
        List<IPAddress> bypassAddresses = confService.getBypassHosts();
        List<IPAddress> enforceAddresses = confService.getEnforceHosts();
        
        // Check the bypass list for the client address, and set the enforce
        // flag to the opposite.
        boolean enforceHost = !(IPAddressListProperty.addressListContains(bypassAddresses, clientAddr));
        
        // Only continue processing if the list is not empty
        if (!enforceAddresses.isEmpty()) {
            
            // If client address is not available or invalid, MFA will
            // be enforced.
            if (clientAddr == null || !clientAddr.isIPAddress())
                enforceHost = true;
            
            // Check the enforce list and set the flag if the client address
            // is found in the list.
            else
                enforceHost = IPAddressListProperty.addressListContains(enforceAddresses, clientAddr);
        }
            
        // If the enforce flag is not true, bypass TOTP MFA.
        if (!enforceHost)
            return;
        
        // Ignore anonymous users
        String username = authenticatedUser.getIdentifier();
        if (username.equals(AuthenticatedUser.ANONYMOUS_IDENTIFIER))
            return;

        // Check if TOTP has been disabled for this user
        if (totpDisabled(context, authenticatedUser))
            return;
        
        // Ignore users which do not have an associated key
        UserTOTPKey key = getKey(context, username);
        if (key == null)
            return;

        // Retrieve TOTP from request
        String code = credentials.getParameter(AuthenticationCodeField.PARAMETER_NAME);

        // If no TOTP provided, request one
        if (code == null) {

            AuthenticationCodeField field = codeFieldProvider.get();

            // If the user hasn't completed enrollment, request that they do
            if (!key.isConfirmed()) {
                
                // If the key has not yet been confirmed, generate a new one.
                key = generateKey(context, username);
                
                field.exposeKey(key);
                throw new TranslatableGuacamoleInsufficientCredentialsException(
                        "TOTP enrollment must be completed before "
                        + "authentication can continue",
                        "TOTP.INFO_ENROLL_REQUIRED", new CredentialsInfo(
                            Collections.<Field>singletonList(field)
                        ));
            }

            // Otherwise simply request the user's authentication code
            throw new TranslatableGuacamoleInsufficientCredentialsException(
                    "A TOTP authentication code is required before login can "
                    + "continue", "TOTP.INFO_CODE_REQUIRED", new CredentialsInfo(
                        Collections.<Field>singletonList(field)
                    ));

        }

        try {

            // Get generator based on user's key and provided configuration
            TOTPGenerator totp = new TOTPGenerator(key.getSecret(),
                    confService.getMode(), confService.getDigits(),
                    TOTPGenerator.DEFAULT_START_TIME, confService.getPeriod());

            // Verify provided TOTP against value produced by generator
            if ((code.equals(totp.generate()) || code.equals(totp.previous()))
                    && codeService.useCode(username, code)) {

                // Record key as confirmed, if it hasn't already been so recorded
                if (!key.isConfirmed()) {
                    key.setConfirmed(true);
                    setKey(context, key);
                }

                // User has been verified
                return;

            }

        }
        catch (InvalidKeyException e) {
            logger.warn("User \"{}\" is associated with an invalid TOTP key.", username);
            logger.debug("TOTP key is not valid.", e);
        }

        // Provided code is not valid
        throw new TranslatableGuacamoleClientException("Provided TOTP code "
                + "is not valid.", "TOTP.INFO_VERIFICATION_FAILED");

    }

}
