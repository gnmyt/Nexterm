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

/**
 * Base abstract resource implementation which provides an associated mimetype,
 * and modification time. Classes which extend AbstractResource must provide
 * their own InputStream, however.
 */
public abstract class AbstractResource implements Resource {

    /**
     * The mimetype of this resource.
     */
    private final String mimetype;

    /**
     * The time this resource was last modified, in milliseconds since midnight
     * of January 1, 1970 UTC.
     */
    private final long lastModified;

    /**
     * Initializes this AbstractResource with the given mimetype and
     * modification time.
     *
     * @param mimetype
     *     The mimetype of this resource.
     *
     * @param lastModified
     *     The time this resource was last modified, in milliseconds since
     *     midnight of January 1, 1970 UTC.
     */
    public AbstractResource(String mimetype, long lastModified) {
        this.mimetype = mimetype;
        this.lastModified = lastModified;
    }

    /**
     * Initializes this AbstractResource with the given mimetype. The
     * modification time of the resource is set to the current system time.
     *
     * @param mimetype
     *     The mimetype of this resource.
     */
    public AbstractResource(String mimetype) {
        this(mimetype, System.currentTimeMillis());
    }

    @Override
    public long getLastModified() {
        return lastModified;
    }

    @Override
    public String getMimeType() {
        return mimetype;
    }

}
