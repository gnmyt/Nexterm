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
import java.net.URI;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.core.Response;
import javax.ws.rs.FormParam;
import javax.ws.rs.Path;
import javax.ws.rs.POST;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.saml.AuthenticationProviderService;
import org.apache.guacamole.auth.saml.conf.ConfigurationService;
import org.apache.guacamole.auth.sso.SSOResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * REST API resource that provides a SAML assertion consumer service (ACS)
 * endpoint. SAML identity providers will issue an HTTP POST to this endpoint
 * asserting the user's identity when the user has successfully authenticated.
 */
public class AssertionConsumerServiceResource extends SSOResource {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(AssertionConsumerServiceResource.class);

    /**
     * The configuration service for this module.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Manager of active SAML authentication attempts.
     */
    @Inject
    private SAMLAuthenticationSessionManager sessionManager;

    /**
     * Service for processing SAML requests/responses.
     */
    @Inject
    private SAMLService saml;

    /**
     * Processes the SAML response submitted by the SAML IdP via an HTTP POST.
     * If SSO has been successful, the user is redirected back to Guacamole to
     * complete authentication. If SSO has failed, the user is redirected back
     * to Guacamole to re-attempt authentication.
     *
     * @param relayState
     *     The "RelayState" value originally provided in the SAML request,
     *     which in our case is the transient the session identifier of the
     *     in-progress authentication attempt. The SAML standard requires that
     *     the identity provider include the "RelayState" value it received
     *     alongside its SAML response.
     *
     * @param samlResponse
     *     The encoded response returned by the SAML IdP.
     *
     * @param consumedRequest
     *     The HttpServletRequest associated with the SAML response. The
     *     parameters of this request may not be accessible, as the request may
     *     have been fully consumed by JAX-RS.
     *
     * @return
     *     An HTTP Response that will redirect the user back to Guacamole,
     *     with an internal state identifier included in the URL such that the
     *     the Guacamole side of authentication can complete.
     *
     * @throws GuacamoleException
     *     If configuration information required for processing SAML responses
     *     cannot be read.
     */
    @POST
    @Path("callback")
    public Response processSamlResponse(
            @FormParam("RelayState") String relayState,
            @FormParam("SAMLResponse") String samlResponse,
            @Context HttpServletRequest consumedRequest)
            throws GuacamoleException {

        URI guacBase = confService.getCallbackUrl();

        try {

            // Validate and parse identity asserted by SAML IdP
            SAMLAuthenticationSession session = saml.processResponse(
                    consumedRequest.getRequestURL().toString(),
                    relayState, samlResponse);

            // Store asserted identity for future retrieval via redirect
            String identifier = sessionManager.defer(session);

            // Redirect user such that Guacamole's authentication system can
            // retrieve the relevant SAML identity (stored above)
            return Response.seeOther(UriBuilder.fromUri(guacBase)
                    .queryParam(AuthenticationProviderService.AUTH_SESSION_QUERY_PARAM, identifier)
                    .build()
            ).build();

        }

        // If invalid, redirect back to main page to re-attempt authentication
        catch (GuacamoleException e) {
            logger.warn("Authentication attempted with an invalid SAML response: {}", e.getMessage());
            logger.debug("Received SAML response failed validation.", e);
            return Response.seeOther(guacBase).build();
        }

    }

}
