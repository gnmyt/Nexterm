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

package org.apache.guacamole.rest;

import java.util.function.Function;
import javax.inject.Inject;
import javax.ws.rs.ext.Provider;
import org.apache.guacamole.rest.auth.AuthenticationService;
import org.glassfish.jersey.server.ContainerRequest;
import org.glassfish.jersey.server.model.Parameter;
import org.glassfish.jersey.server.spi.internal.ValueParamProvider;

/**
 * Provider which automatically maps Guacamole authentication tokens received
 * via REST API requests to parameters that have been annotated with the
 * <code>@TokenParam</code> annotation.
 */
@Provider
public class TokenParamProvider implements ValueParamProvider {

    /**
     * Service for authenticating users and working with the resulting
     * authentication tokens.
     */
    @Inject
    private AuthenticationService authenticationService;

    @Override
    public Function<ContainerRequest, ?> getValueProvider(Parameter parameter) {

        if (parameter.getAnnotation(TokenParam.class) == null)
            return null;

        return (request) -> authenticationService.getAuthenticationToken(request);

    }

    @Override
    public PriorityType getPriority() {
        return Priority.HIGH;
    }

}
