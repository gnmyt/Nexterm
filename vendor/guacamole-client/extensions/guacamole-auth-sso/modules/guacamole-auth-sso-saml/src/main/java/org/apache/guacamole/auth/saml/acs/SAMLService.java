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

package org.apache.guacamole.auth.saml.acs;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.onelogin.saml2.Auth;
import com.onelogin.saml2.authn.AuthnRequestParams;
import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.exception.SettingsException;
import com.onelogin.saml2.exception.ValidationError;
import com.onelogin.saml2.settings.Saml2Settings;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPathExpressionException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.saml.conf.ConfigurationService;
import org.apache.guacamole.net.auth.IdentifierGenerator;
import org.xml.sax.SAXException;

/**
 * Service which abstracts the internals of handling SAML requests and
 * responses.
 */
@Singleton
public class SAMLService {

    /**
     * Service for retrieving SAML configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Manager of active SAML authentication attempts.
     */
    @Inject
    private SAMLAuthenticationSessionManager sessionManager;

    /**
     * Creates a new SAML request, beginning the overall authentication flow
     * that will ultimately result in an asserted user identity if the user is
     * successfully authenticated by the SAML IdP. The URI of the SSO endpoint
     * of the SAML IdP that the user must be redirected to for the
     * authentication process to continue is returned.
     *
     * @return
     *     The URI of the SSO endpoint of the SAML IdP that the user must be
     *     redirected to.
     *
     * @throws GuacamoleException
     *     If an error prevents the SAML request and redirect URI from being
     *     generated.
     */
    public URI createRequest() throws GuacamoleException {

        Saml2Settings samlSettings = confService.getSamlSettings();

        // Produce redirect for continuing the authentication process with
        // the SAML IdP
        try {
            Auth auth = new Auth(samlSettings, null, null);

            // Generate a unique ID to use for the relay state
            String identifier = IdentifierGenerator.generateIdentifier();

            // Create the request URL for the SAML IdP
            String requestUrl = auth.login(
                    identifier,
                    new AuthnRequestParams(false, false, true),
                    true);

            // Create a new authentication session to represent this attempt while
            // it is in progress, using the request ID that was just issued
            SAMLAuthenticationSession session = new SAMLAuthenticationSession(
                    auth.getLastRequestId(),
                    confService.getAuthenticationTimeout() * 60000L);

            // Save the session with the unique relay state ID
            sessionManager.defer(session, identifier);

            return new URI(requestUrl);
        }
        catch (IOException e) {
            throw new GuacamoleServerException("SAML authentication request "
                    + "could not be encoded: " + e.getMessage());
        }
        catch (URISyntaxException e) {
            throw new GuacamoleServerException("SAML IdP redirect could not "
                    + "be generated due to an error in the URI syntax: "
                    + e.getMessage());
        }
        catch (SettingsException e) {
            throw new GuacamoleServerException("Error while attempting to sign "
                    + "request using provided private key / certificate: "
                    + e.getMessage(), e);
        }

    }

    /**
     * Processes the given SAML response, as received by the SAML ACS endpoint
     * at the given URL, producing an {@link SAMLAuthenticationSession} that now
     * includes a valid assertion of the user's identity. If the SAML response
     * is invalid in any way, an exception is thrown.
     *
     * @param url
     *     The URL of the ACS endpoint that received the SAML response. This
     *     should be the URL pointing to the single POST-handling endpoint of
     *     {@link AssertionConsumerServiceResource}.
     *
     * @param relayState
     *     The "RelayState" value originally provided in the SAML request,
     *     which in our case is the transient the session identifier of the
     *     in-progress authentication attempt. The SAML standard requires that
     *     the identity provider include the "RelayState" value it received
     *     alongside its SAML response.
     *
     * @param encodedResponse
     *     The response received from the SAML IdP via the ACS endpoint at the
     *     given URL.
     *
     * @return
     *     The {@link SAMLAuthenticationSession} associated with the in-progress
     *     authentication attempt, now associated with the {@link AssertedIdentity}
     *     representing the identity of the user asserted by the SAML IdP.
     *
     * @throws GuacamoleException
     *     If the given SAML response is not valid, or if the configuration
     *     information required to validate or decrypt the response cannot be
     *     read.
     */
    public SAMLAuthenticationSession processResponse(String url, String relayState,
            String encodedResponse) throws GuacamoleException {

        if (relayState == null)
            throw new GuacamoleSecurityException("\"RelayState\" value "
                    + "is missing from SAML response.");

        SAMLAuthenticationSession session = sessionManager.resume(relayState);
        if (session == null)
            throw new GuacamoleSecurityException("\"RelayState\" value "
                    + "included with SAML response is not valid.");

        try {

            // Decode received SAML response
            SamlResponse response = new SamlResponse(confService.getSamlSettings(),
                    url, encodedResponse);

            // Validate SAML response timestamp, signature, etc.
            if (!response.isValid(session.getRequestID())) {
                Exception validationException = response.getValidationException();
                throw new GuacamoleSecurityException("SAML response did not "
                        + "pass validation: " + validationException.getMessage(),
                        validationException);
            }

            // Parse identity asserted by SAML IdP
            session.setIdentity(new AssertedIdentity(response));
            return session;

        }
        catch (ValidationError e) {
            throw new GuacamoleSecurityException("SAML response did not pass "
                    + "validation: " + e.getMessage(), e);
        }
        catch (SettingsException e) {
            throw new GuacamoleServerException("Current SAML settings are "
                    + "insufficient to decrypt/parse the received SAML "
                    + "response.", e);
        }
        catch (ParserConfigurationException | SAXException | XPathExpressionException e) {
            throw new GuacamoleServerException("XML contents of SAML "
                    + "response could not be parsed.", e);
        }
        catch (IOException e) {
            throw new GuacamoleServerException("Contents of SAML response "
                    + "could not be decrypted/read.", e);
        }

    }

}
