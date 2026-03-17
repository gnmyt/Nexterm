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

import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ResourceInfo;
import javax.ws.rs.core.Context;
import javax.ws.rs.ext.Provider;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.LongGuacamoleProperty;

/**
 * Filter which restricts REST API requests to a particular maximum size.
 */
@Singleton
@Provider
public class RequestSizeFilter implements ContainerRequestFilter {

    /**
     * Informs the RequestSizeFilter to NOT enforce its request size limits on
     * requests serviced by the annotated method.
     */
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    public static @interface DoNotLimit {}

    /**
     * The default maximum number of bytes to accept within the entity body of
     * any particular REST request.
     */
    private static final long DEFAULT_MAX_REQUEST_SIZE = 2097152;

    /**
     * The maximum number of bytes to accept within the entity body of any
     * particular REST request. If not specified, requests will be limited to
     * 2 MB by default. Specifying 0 disables request size limitations.
     */
    private final LongGuacamoleProperty API_MAX_REQUEST_SIZE = new LongGuacamoleProperty() {

        @Override
        public String getName() { return "api-max-request-size"; }

    };

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Information describing the resource that was requested.
     */
    @Context
    private ResourceInfo resourceInfo;

    @Override
    public void filter(ContainerRequestContext context) throws IOException {

        // Retrieve configured request size limits
        final long maxRequestSize;
        try {
            maxRequestSize = environment.getProperty(API_MAX_REQUEST_SIZE, DEFAULT_MAX_REQUEST_SIZE);
        }
        catch (GuacamoleException e) {
            throw new APIException(e);
        }

        // Ignore request size if limit is disabled
        if (maxRequestSize == 0 || resourceInfo.getResourceMethod().isAnnotationPresent(DoNotLimit.class))
            return;

        // Restrict maximum size of requests which have an input stream
        // available to be limited
        InputStream stream = context.getEntityStream();
        if (stream != null)
            context.setEntityStream(new LimitedRequestInputStream(stream, maxRequestSize));

    }

}
