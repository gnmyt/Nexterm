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

/**
 * An arbitrary resource that can be served to a user via HTTP. Resources are
 * anonymous but have a defined mimetype and corresponding input stream.
 */
public interface Resource {

    /**
     * Returns the mimetype of this resource. This function MUST always return
     * a value. If the type is unknown, return "application/octet-stream".
     *
     * @return
     *     The mimetype of this resource.
     */
    String getMimeType();

    /**
     * Returns the time the resource was last modified in milliseconds since
     * midnight of January 1, 1970 UTC.
     *
     * @return
     *      The time the resource was last modified, in milliseconds.
     */
    long getLastModified();

    /**
     * Returns an InputStream which reads the contents of this resource,
     * starting with the first byte. Reading from the returned InputStream will
     * not affect reads from other InputStreams returned by other calls to
     * asStream(). The returned InputStream must be manually closed when no
     * longer needed. If the resource is unexpectedly unavailable, this will
     * return null.
     *
     * @return
     *     An InputStream which reads the contents of this resource, starting
     *     with the first byte, or null if the resource is unavailable.
     */
    InputStream asStream();

}
