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

package org.apache.guacamole.rest.history;

import javax.ws.rs.GET;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActivityLog;

/**
 * A REST resource which exposes the contents of a given ActivityLog.
 */
public class ActivityLogResource {

    /**
     * The ActivityLog whose contents are being exposed.
     */
    private final ActivityLog log;

    /**
     * Creates a new ActivityLogResource which exposes the records within the
     * given ActivityLog.
     *
     * @param log
     *     The ActivityLog whose contents should be exposed.
     */
    public ActivityLogResource(ActivityLog log) {
        this.log = log;
    }

    /**
     * Returns the raw contents of the underlying ActivityLog. If the size of
     * the ActivityLog is known, this size is included as the "Content-Length"
     * of the response.
     *
     * @return
     *     A Response containing the raw contents of the underlying
     *     ActivityLog.
     *
     * @throws GuacamoleException
     *     If an error prevents retrieving the content of the log or its size.
     */
    @GET
    public Response getContents() throws GuacamoleException {

        // Build base response exposing the raw contents of the underlying log
        ResponseBuilder response = Response.ok(log.getContent(),
                log.getType().getContentType());

        // Include size, if known
        long size = log.getSize();
        if (size >= 0)
            response.header("Content-Length", size);

        return response.build();

    }

}
