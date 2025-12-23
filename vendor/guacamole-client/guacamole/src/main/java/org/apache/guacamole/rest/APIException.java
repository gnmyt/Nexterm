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

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import org.apache.guacamole.GuacamoleException;

/**
 * An exception which exposes a given error within the API layer. When thrown
 * within the context of the REST API, an appropriate HTTP status code will be
 * set for the failing response, and the details of the error will be exposed in
 * the body of the response as an APIError structure.
 */
public class APIException extends WebApplicationException {

    /**
     * Construct a new APIException based on the given GuacamoleException. The
     * details of the GuacamoleException relevant to the REST API will be
     * exposed via an APIError.
     *
     * @param exception
     *     The GuacamoleException that occurred.
     */
    public APIException(GuacamoleException exception) {
        super(Response.status(exception.getHttpStatusCode())
                .type(MediaType.APPLICATION_JSON)
                .entity(new APIError(exception))
                .build());
    }

}
