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
import java.io.SequenceInputStream;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.Iterator;

/**
 * A resource which is the logical concatenation of other resources.
 */
public class SequenceResource extends AbstractResource {

    /**
     * The resources to be concatenated.
     */
    private final Iterable<Resource> resources;

    /**
     * Returns the mimetype of the first resource in the given Iterable, or
     * "application/octet-stream" if no resources are provided.
     *
     * @param resources
     *     The resources from which the mimetype should be retrieved.
     *
     * @return
     *     The mimetype of the first resource, or "application/octet-stream"
     *     if no resources were provided.
     */
    private static String getMimeType(Iterable<Resource> resources) {

        // If no resources, just assume application/octet-stream
        Iterator<Resource> resourceIterator = resources.iterator();
        if (!resourceIterator.hasNext())
            return "application/octet-stream";

        // Return mimetype of first resource
        return resourceIterator.next().getMimeType();

    }

    /**
     * Creates a new SequenceResource as the logical concatenation of the
     * given resources. Each resource is concatenated in iteration order as
     * needed when reading from the input stream of the SequenceResource.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param resources
     *     The resources to concatenate within the InputStream of this
     *     SequenceResource.
     */
    public SequenceResource(String mimetype, Iterable<Resource> resources) {
        super(mimetype);
        this.resources = resources;
    }

    /**
     * Creates a new SequenceResource as the logical concatenation of the
     * given resources. Each resource is concatenated in iteration order as
     * needed when reading from the input stream of the SequenceResource. The
     * mimetype of the resulting concatenation is derived from the first
     * resource.
     *
     * @param resources
     *     The resources to concatenate within the InputStream of this
     *     SequenceResource.
     */
    public SequenceResource(Iterable<Resource> resources) {
        super(getMimeType(resources));
        this.resources = resources;
    }

    /**
     * Creates a new SequenceResource as the logical concatenation of the
     * given resources. Each resource is concatenated in iteration order as
     * needed when reading from the input stream of the SequenceResource.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param resources
     *     The resources to concatenate within the InputStream of this
     *     SequenceResource.
     */
    public SequenceResource(String mimetype, Resource... resources) {
        this(mimetype, Arrays.asList(resources));
    }

    /**
     * Creates a new SequenceResource as the logical concatenation of the
     * given resources. Each resource is concatenated in iteration order as
     * needed when reading from the input stream of the SequenceResource. The
     * mimetype of the resulting concatenation is derived from the first
     * resource.
     *
     * @param resources
     *     The resources to concatenate within the InputStream of this
     *     SequenceResource.
     */
    public SequenceResource(Resource... resources) {
        this(Arrays.asList(resources));
    }

    @Override
    public InputStream asStream() {
        return new SequenceInputStream(new Enumeration<InputStream>() {

            /**
             * Iterator over all resources associated with this
             * SequenceResource.
             */
            private final Iterator<Resource> resourceIterator = resources.iterator();

            @Override
            public boolean hasMoreElements() {
                return resourceIterator.hasNext();
            }

            @Override
            public InputStream nextElement() {
                return resourceIterator.next().asStream();
            }

        });
    }

}
