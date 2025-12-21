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

package org.apache.guacamole.resource;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Servlet which serves a given resource for all HTTP GET requests. The HEAD
 * method is correctly supported, and HTTP 304 ("Not Modified") responses will
 * be properly returned for GET requests depending on the last time the
 * resource was modified.
 */
public class ResourceServlet extends HttpServlet {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ResourceServlet.class);

    /**
     * The size of the buffer to use when transferring data from the input
     * stream of a resource to the output stream of a request.
     */
    private static final int BUFFER_SIZE = 10240;

    /**
     * The resource to serve for every GET request.
     */
    private final Resource resource;

    /**
     * Creates a new ResourceServlet which serves the given Resource for all
     * HTTP GET requests.
     *
     * @param resource
     *     The Resource to serve.
     */
    public ResourceServlet(Resource resource) {
        this.resource = resource;
    }

    @Override
    protected void doHead(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Request that the browser revalidate cached data
        response.addHeader("Cache-Control", "no-cache");
        response.addHeader("Pragma", "no-cache");

        // Set last modified and content type headers
        response.addDateHeader("Last-Modified", resource.getLastModified());
        response.setContentType(resource.getMimeType());

    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Get input stream from resource
        InputStream input = resource.asStream();

        // If resource does not exist, return not found
        if (input == null) {
            logger.debug("Resource does not exist: \"{}\"", request.getServletPath());
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        try {

            // Write headers
            doHead(request, response);

            // If not modified since "If-Modified-Since" header, return not modified
            long ifModifiedSince = request.getDateHeader("If-Modified-Since");
            if (resource.getLastModified() - ifModifiedSince < 1000) {
                logger.debug("Resource not modified: \"{}\"", request.getServletPath());
                response.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
                return;
            }

            int length;
            byte[] buffer = new byte[BUFFER_SIZE];

            // Write resource to response body
            OutputStream output = response.getOutputStream();
            while ((length = input.read(buffer)) != -1)
                output.write(buffer, 0, length);

        }

        // Ensure input stream is always closed
        finally {
            input.close();
        }

    }

}
