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

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnauthorizedException;
import org.apache.guacamole.rest.auth.AuthenticationService;
import org.glassfish.jersey.server.ContainerRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A class that maps GuacamoleExceptions in a way that returns a
 * custom response to the user via JSON rather than allowing the default
 * web application error handling to take place.
 */
@Provider
@Singleton
public class RESTExceptionMapper implements ExceptionMapper<Throwable> {
    
    /**
     * The logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(RESTExceptionMapper.class);
    
    /**
     * The ContainerRequest representing the HTTP request that resulted in the
     * Throwable being intercepted. Despite this class being a Singleton, this
     * object will always be scoped with the current request for the Throwable
     * that is being processed by this class.
     */
    @Context
    private ContainerRequest request;
    
    /**
     * The authentication service associated with the currently active session.
     */
    @Inject
    private AuthenticationService authenticationService;

    @Override
    public Response toResponse(Throwable t) {

        // Pass WebApplicationException responses through untouched
        if (t instanceof WebApplicationException)
            return ((WebApplicationException) t).getResponse();
        
        // Ensure any associated session is invalidated if unauthorized 
        if (t instanceof GuacamoleUnauthorizedException) {
            String token = authenticationService.getAuthenticationToken(request);
            if (authenticationService.destroyGuacamoleSession(token))
                logger.debug("Implicitly invalidated session for token \"{}\"", token);
        }
        
        // Translate GuacamoleException subclasses to HTTP error codes 
        if (t instanceof GuacamoleException) {

            // Always log the human-readable details of GuacacamoleExceptions
            // for the benefit of the administrator
            if (t instanceof GuacamoleClientException)
                logger.debug("Client request rejected: {}", t.getMessage());
            else {
                logger.error("Request could not be processed: {}", t.getMessage());
                logger.debug("Processing of request aborted by extension.", t);
            }

            return Response
                    .status(((GuacamoleException) t).getHttpStatusCode())
                    .entity(new APIError((GuacamoleException) t))
                    .type(MediaType.APPLICATION_JSON)
                    .build();
        }
        
        // Wrap unchecked exceptions
        String message = t.getMessage();
        if (message != null)
            logger.error("Unexpected internal error: {}", message);
        else
            logger.error("An internal error occurred, but did not contain "
                    + "an error message. Enable debug-level logging for "
                    + "details.");
            
        logger.debug("Unexpected error in REST endpoint.", t);
            
        return Response
                .status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new APIError(
                        new GuacamoleException("Unexpected internal error", t)))
                .type(MediaType.APPLICATION_JSON)
                .build();
        
    }
    
}
