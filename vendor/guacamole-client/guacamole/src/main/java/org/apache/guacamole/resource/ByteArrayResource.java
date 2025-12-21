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

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/**
 * A resource which contains a defined byte array.
 */
public class ByteArrayResource extends AbstractResource {

    /**
     * The bytes contained by this resource.
     */
    private final byte[] bytes;

    /**
     * Creates a new ByteArrayResource which provides access to the given byte
     * array. Changes to the given byte array will affect this resource even
     * after the resource is created. Changing the byte array while an input
     * stream from this resource is in use has undefined behavior.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param bytes
     *     The bytes that this resource should contain.
     */
    public ByteArrayResource(String mimetype, byte[] bytes) {
        super(mimetype);
        this.bytes = bytes;
    }

    @Override
    public InputStream asStream() {
        return new ByteArrayInputStream(bytes);
    }

}
