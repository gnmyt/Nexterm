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

package org.apache.guacamole.rest.extension;

import java.util.List;
import javax.inject.Inject;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.net.auth.AuthenticationProvider;

/**
 * A REST service which provides access to extension-specific REST resources,
 * each exposed by the identifier of that extension's AuthenticationProvider.
 */
@Path("/ext")
public class ExtensionRESTService {

    /**
     * All configured authentication providers.
     */
    @Inject
    private List<AuthenticationProvider> authProviders;

    /**
     * Returns the AuthenticationProvider having the given identifier. If no
     * such AuthenticationProvider has been loaded, null is returned.
     *
     * @param identifier
     *     The identifier of the AuthenticationProvider to locate.
     *
     * @return
     *     The AuthenticationProvider having the given identifier, or null if
     *     no such AuthenticationProvider is loaded.
     */
    private AuthenticationProvider getAuthenticationProvider(String identifier) {

        // Iterate through all installed AuthenticationProviders, searching for
        // the given identifier
        for (AuthenticationProvider authProvider : authProviders) {
            if (authProvider.getIdentifier().equals(identifier))
                return authProvider;
        }

        // No such AuthenticationProvider found
        return null;

    }

    /**
     * Returns the arbitrary REST resource exposed by the AuthenticationProvider
     * having the given identifier.
     *
     * @param identifier
     *     The identifier of the AuthenticationProvider whose REST resource
     *     should be retrieved.
     *
     * @return
     *     The arbitrary REST resource exposed by the AuthenticationProvider
     *     having the given identifier.
     *
     * @throws GuacamoleException
     *     If no such resource could be found, or if an error occurs while
     *     retrieving that resource.
     */
    @Path("{identifier}")
    public Object getExtensionResource(@PathParam("identifier") String identifier)
            throws GuacamoleException {

        // Retrieve authentication provider having given identifier
        AuthenticationProvider authProvider = getAuthenticationProvider(identifier);
        if (authProvider != null) {

            // Pull resource from authentication provider
            Object resource = authProvider.getResource();
            if (resource != null)
                return resource;

        }

        // AuthenticationProvider-specific resource could not be found
        throw new GuacamoleResourceNotFoundException("No such resource.");

    }

}
