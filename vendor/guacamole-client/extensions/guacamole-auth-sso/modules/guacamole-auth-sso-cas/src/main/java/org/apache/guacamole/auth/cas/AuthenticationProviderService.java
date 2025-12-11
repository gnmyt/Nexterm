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

package org.apache.guacamole.auth.cas;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import java.net.URI;
import java.util.Arrays;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.apache.guacamole.auth.cas.conf.ConfigurationService;
import org.apache.guacamole.auth.cas.ticket.TicketValidationService;
import org.apache.guacamole.auth.sso.SSOAuthenticationProviderService;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.form.RedirectField;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * Service that authenticates Guacamole users by processing CAS tickets.
 */
@Singleton
public class AuthenticationProviderService implements SSOAuthenticationProviderService {

    /**
     * The parameter that will be present upon successful CAS authentication.
     */
    public static final String TICKET_PARAMETER_NAME = "ticket";
    
    /**
     * The standard URI name for the CAS login resource.
     */
    private static final String CAS_LOGIN_URI = "login";

    /**
     * Service for retrieving CAS configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Service for validating received ID tickets.
     */
    @Inject
    private TicketValidationService ticketService;

    @Override
    public SSOAuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {

        // Pull CAS ticket from request if present
        String ticket = credentials.getParameter(TICKET_PARAMETER_NAME);
        if (ticket != null) {
            return ticketService.validateTicket(ticket, credentials);
        }

        // Request CAS ticket (will automatically redirect the user to the
        // CAS authorization page via JavaScript)
        throw new GuacamoleInvalidCredentialsException("Invalid login.",
            new CredentialsInfo(Arrays.asList(new Field[] {
                new RedirectField(TICKET_PARAMETER_NAME, getLoginURI(),
                        new TranslatableMessage("LOGIN.INFO_IDP_REDIRECT_PENDING"))

            }))
        );

    }

    @Override
    public URI getLoginURI() throws GuacamoleException {
        return UriBuilder.fromUri(confService.getAuthorizationEndpoint())
                .path(CAS_LOGIN_URI)
                .queryParam("service", confService.getRedirectURI())
                .build();
    }

    @Override
    public void shutdown() {
        // Nothing to clean up
    }
    
}
