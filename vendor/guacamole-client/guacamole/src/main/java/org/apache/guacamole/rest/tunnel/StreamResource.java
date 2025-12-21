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

package org.apache.guacamole.rest.tunnel;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;
import javax.ws.rs.core.StreamingOutput;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.rest.RequestSizeFilter;
import org.apache.guacamole.tunnel.StreamInterceptingTunnel;

/**
 * A REST resource providing access to a Guacamole protocol-level stream
 * within a tunnel.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StreamResource {

    /**
     * The tunnel whose stream is exposed through this StreamResource.
     */
    private final StreamInterceptingTunnel tunnel;

    /**
     * The index of the stream being exposed.
     */
    private final int streamIndex;

    /**
     * The media type of the data within the stream being exposed.
     */
    private final String mediaType;

    /**
     * Creates a new StreamResource which provides access to the given
     * stream.
     *
     * @param tunnel
     *     The tunnel whose stream is being exposed.
     *
     * @param streamIndex
     *     The index of the stream to expose via this StreamResource.
     *
     * @param mediaType
     *     The media type of the data within the stream.
     */
    public StreamResource(StreamInterceptingTunnel tunnel, int streamIndex,
            String mediaType) {
        this.tunnel = tunnel;
        this.streamIndex = streamIndex;
        this.mediaType = mediaType;
    }

    /**
     * Intercepts and returns the entire contents the stream represented by
     * this StreamResource.
     *
     * @return
     *     A response through which the entire contents of the intercepted
     *     stream will be sent.
     */
    @GET
    public Response getStreamContents() {

        // Intercept all output
        StreamingOutput stream = new StreamingOutput() {

            @Override
            public void write(OutputStream output) throws IOException {
                try {
                    tunnel.interceptStream(streamIndex, output);
                }
                catch (GuacamoleException e) {
                    throw new IOException(e);
                }
            }

        };

        // Begin successful response
        ResponseBuilder responseBuilder = Response.ok(stream, mediaType);

        // Set Content-Disposition header for "application/octet-stream"
        if (mediaType.equals(MediaType.APPLICATION_OCTET_STREAM))
            responseBuilder.header("Content-Disposition", "attachment");

        return responseBuilder.build();

    }

    /**
     * Intercepts the stream represented by this StreamResource, sending the
     * contents of the given InputStream over that stream as "blob"
     * instructions.
     *
     * @param data
     *     An InputStream containing the data to be sent over the intercepted
     *     stream.
     *
     * @throws GuacamoleException
     *     If the intercepted stream closes with an error.
     */
    @POST
    @Consumes(MediaType.WILDCARD)
    @RequestSizeFilter.DoNotLimit
    public void setStreamContents(InputStream data) throws GuacamoleException {

        // Send input over stream
        tunnel.interceptStream(streamIndex, data);

    }

}
