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

package org.apache.guacamole.auth.cas.ticket;

import com.google.common.io.BaseEncoding;
import com.google.inject.Inject;
import com.google.inject.Provider;
import java.net.URI;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import java.nio.charset.Charset;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.cas.conf.ConfigurationService;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.token.TokenName;
import org.jasig.cas.client.authentication.AttributePrincipal;
import org.jasig.cas.client.validation.Assertion;
import org.jasig.cas.client.validation.Cas20ProxyTicketValidator;
import org.jasig.cas.client.validation.TicketValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for validating ID tickets forwarded to us by the client, verifying
 * that they did indeed come from the CAS service.
 */
public class TicketValidationService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(TicketValidationService.class);
    
    /**
     * The prefix to use when generating token names.
     */
    public static final String CAS_ATTRIBUTE_TOKEN_PREFIX = "CAS_";

    /**
     * Service for retrieving CAS configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Provider for AuthenticatedUser objects.
     */
    @Inject
    private Provider<SSOAuthenticatedUser> authenticatedUserProvider;

    /**
     * Converts the given CAS attribute value object (whose type is variable)
     * to a Set of String values. If the value is already a Collection of some
     * kind, its values are converted to Strings and returned as the members of
     * the Set. If the value is not already a Collection, it is assumed to be a
     * single value, converted to a String, and used as the sole member of the
     * set.
     *
     * @param obj
     *     The CAS attribute value to convert to a Set of Strings.
     *
     * @return
     *     A Set of all String values contained within the given CAS attribute
     *     value.
     */
    private Set<String> toStringSet(Object obj) {

        // Consider null to represent no provided values
        if (obj == null)
            return Collections.emptySet();

        // If the provided object is already a Collection, produce a Collection
        // where we know for certain that all values are Strings
        if (obj instanceof Collection) {
            return ((Collection<?>) obj).stream()
                    .map(Object::toString)
                    .collect(Collectors.toSet());
        }

        // Otherwise, assume we have only a single value
        return Collections.singleton(obj.toString());

    }

    /**
     * Validates and parses the given ID ticket, returning a map of all
     * available tokens for the given user based on attributes provided by the
     * CAS server.  If the ticket is invalid an exception is thrown.
     *
     * @param ticket
     *     The ID ticket to validate and parse.
     *
     * @param credentials
     *     The Credentials object to store retrieved username and
     *     password values in.
     *
     * @return
     *     A CASAuthenticatedUser instance containing the ticket data returned by the CAS server.
     *
     * @throws GuacamoleException
     *     If the ID ticket is not valid or guacamole.properties could
     *     not be parsed.
     */
    public SSOAuthenticatedUser validateTicket(String ticket,
            Credentials credentials) throws GuacamoleException {

        // Create a ticket validator that uses the configured CAS URL
        URI casServerUrl = confService.getAuthorizationEndpoint();
        Cas20ProxyTicketValidator validator = new Cas20ProxyTicketValidator(casServerUrl.toString());
        validator.setAcceptAnyProxy(true);
        validator.setEncoding("UTF-8");

        // Attempt to validate the supplied ticket
        Assertion assertion;
        try {
            URI confRedirectURI = confService.getRedirectURI();
            assertion = validator.validate(ticket, confRedirectURI.toString());
        }
        catch (TicketValidationException e) {
            throw new GuacamoleException("Ticket validation failed.", e);
        }

        // Pull user principal and associated attributes
        AttributePrincipal principal =  assertion.getPrincipal();
        Map<String, Object> ticketAttrs = new HashMap<>(principal.getAttributes());

        // Retrieve user identity from principal
        String username = principal.getName();
        if (username == null)
            throw new GuacamoleSecurityException("No username provided by CAS.");

        // Canonicalize username as lowercase
        username = username.toLowerCase();

        // Retrieve password, attempt decryption, and set credentials.
        Object credObj = ticketAttrs.remove("credential");
        if (credObj != null) {
            String clearPass = decryptPassword(credObj.toString());
            if (clearPass != null && !clearPass.isEmpty())
                credentials.setPassword(clearPass);
        }

        Set<String> effectiveGroups;

        // Parse effective groups from principal attributes if a specific
        // group attribute has been configured
        String groupAttribute = confService.getGroupAttribute();
        if (groupAttribute != null) {
            effectiveGroups = toStringSet(ticketAttrs.get(groupAttribute)).stream()
                    .map(confService.getGroupParser()::parse)
                    .collect(Collectors.toSet());
        }

        // Otherwise, assume no effective groups
        else
            effectiveGroups = Collections.emptySet();

        // Convert remaining attributes that have values to Strings
        Map<String, String> tokens = new HashMap<>(ticketAttrs.size());
        ticketAttrs.forEach((key, value) -> {
            if (value != null) {
                String tokenName = TokenName.canonicalize(key, CAS_ATTRIBUTE_TOKEN_PREFIX);
                tokens.put(tokenName, value.toString());
            }
        });

        SSOAuthenticatedUser authenticatedUser = authenticatedUserProvider.get();
        authenticatedUser.init(username, credentials, effectiveGroups, tokens);
        return authenticatedUser;

    }

    /**
     * Takes an encrypted string representing a password provided by
     * the CAS ClearPass service and decrypts it using the private
     * key configured for this extension.  Returns null if it is
     * unable to decrypt the password.
     *
     * @param encryptedPassword
     *     A string with the encrypted password provided by the
     *     CAS service.
     *
     * @return
     *     The decrypted password, or null if it is unable to
     *     decrypt the password.
     *
     * @throws GuacamoleException
     *     If unable to get Guacamole configuration data
     */
    private final String decryptPassword(String encryptedPassword)
            throws GuacamoleException {

        // If we get nothing, we return nothing.
        if (encryptedPassword == null || encryptedPassword.isEmpty()) {
            logger.warn("No or empty encrypted password, no password will be available.");
            return null;
        }

        final PrivateKey clearpassKey = confService.getClearpassKey();
        if (clearpassKey == null) {
            logger.debug("No private key available to decrypt password.");
            return null;
        }

        try {

            final Cipher cipher = Cipher.getInstance(clearpassKey.getAlgorithm());

            if (cipher == null)
                throw new GuacamoleServerException("Failed to initialize cipher object with private key.");

            // Initialize the Cipher in decrypt mode.
            cipher.init(Cipher.DECRYPT_MODE, clearpassKey);

            // Decode and decrypt, and return a new string.
            final byte[] pass64 = BaseEncoding.base64().decode(encryptedPassword);
            final byte[] cipherData = cipher.doFinal(pass64);
            return new String(cipherData, Charset.forName("UTF-8"));

        }
        catch (BadPaddingException e) {
            throw new GuacamoleServerException("Bad padding when decrypting cipher data.", e);
        }
        catch (IllegalBlockSizeException e) {
            throw new GuacamoleServerException("Illegal block size while opening private key.", e);
        }
        catch (InvalidKeyException e) {
            throw new GuacamoleServerException("Specified private key for ClearPass decryption is invalid.", e);
        }
        catch (NoSuchAlgorithmException e) {
            throw new GuacamoleServerException("Unexpected algorithm for the private key.", e);
        }
        catch (NoSuchPaddingException e) {
            throw new GuacamoleServerException("No such padding trying to initialize cipher with private key.", e);
        }

    }

}
