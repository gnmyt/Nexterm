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
 * A resource which is located within the classpath of an arbitrary
 * ClassLoader.
 */
public class ClassPathResource extends AbstractResource {

    /**
     * The classloader to use when reading this resource.
     */
    private final ClassLoader classLoader;

    /**
     * The path of this resource relative to the classloader.
     */
    private final String path;

    /**
     * Creates a new ClassPathResource which uses the given ClassLoader to
     * read the resource having the given path.
     *
     * @param classLoader
     *     The ClassLoader to use when reading the resource.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param path
     *     The path of the resource relative to the given ClassLoader.
     */
    public ClassPathResource(ClassLoader classLoader, String mimetype, String path) {
        super(mimetype);
        this.classLoader = classLoader;
        this.path = path;
    }

    /**
     * Creates a new ClassPathResource which uses the ClassLoader associated
     * with the ClassPathResource class to read the resource having the given
     * path.
     *
     * @param mimetype
     *     The mimetype of the resource.
     *
     * @param path
     *     The path of the resource relative to the ClassLoader associated
     *     with the ClassPathResource class.
     */
    public ClassPathResource(String mimetype, String path) {
        this(ClassPathResource.class.getClassLoader(), mimetype, path);
    }

    @Override
    public InputStream asStream() {
        return classLoader.getResourceAsStream(path);
    }

}
