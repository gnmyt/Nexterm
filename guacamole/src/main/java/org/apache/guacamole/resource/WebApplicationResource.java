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

import java.io.InputStream;
import javax.servlet.ServletContext;

/**
 * A resource which is located within the classpath associated with another
 * class.
 */
public class WebApplicationResource extends AbstractResource {

    /**
     * The servlet context to use when reading the resource and, if necessary,
     * when determining the mimetype of the resource.
     */
    private final ServletContext context;

    /**
     * The path of this resource relative to the ServletContext.
     */
    private final String path;

    /**
     * Derives a mimetype from the filename within the given path using the
     * given ServletContext, if possible.
     *
     * @param context
     *     The ServletContext to use to derive the mimetype.
     *
     * @param path
     *     The path to derive the mimetype from.
     *
     * @return
     *     An appropriate mimetype based on the name of the file in the path,
     *     or "application/octet-stream" if no mimetype could be determined.
     */
    private static String getMimeType(ServletContext context, String path) {

        // If mimetype is known, use defined mimetype
        String mimetype = context.getMimeType(path);
        if (mimetype != null)
            return mimetype;

        // Otherwise, default to application/octet-stream
        return "application/octet-stream";

    }

    /**
     * Creates a new WebApplicationResource which serves the resource at the
     * given path relative to the given ServletContext. Rather than deriving
     * the mimetype of the resource from the filename within the path, the
     * mimetype given is used.
     *
     * @param context
     *     The ServletContext to use when reading the resource.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param path
     *     The path of the resource relative to the given ServletContext.
     */
    public WebApplicationResource(ServletContext context, String mimetype, String path) {
        super(mimetype);
        this.context = context;
        this.path = path;
    }

    /**
     * Creates a new WebApplicationResource which serves the resource at the
     * given path relative to the given ServletContext. The mimetype of the
     * resource is automatically determined based on the filename within the
     * path.
     *
     * @param context
     *     The ServletContext to use when reading the resource and deriving the
     *     mimetype.
     *
     * @param path
     *     The path of the resource relative to the given ServletContext.
     */
    public WebApplicationResource(ServletContext context, String path) {
        this(context, getMimeType(context, path), path);
    }

    @Override
    public InputStream asStream() {
        return context.getResourceAsStream(path);
    }

}
