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

package org.apache.guacamole.auth.jdbc;

import com.google.inject.Injector;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.guacamole.GuacamoleException;

/**
 * A caching provider of singleton Guice Injector instances. The first call to
 * get() will return a new instance of the Guice Injector, while all subsequent
 * calls will return that same instance. It is up to implementations of this
 * class to define how the Guice Injector will be created through defining the
 * create() function.
 *
 * IMPORTANT: Because the Injector returned by get() is cached statically, only
 * ONE implementation of this class may be used within any individual
 * classloader. Within the context of the JDBC extension, as long as each built
 * extension only provides one subclass of this class, things should work
 * properly, as each extension is given its own classloader by Guacamole.
 */
public abstract class JDBCInjectorProvider {

    /**
     * An AtomicReference wrapping the cached Guice Injector. If the Injector
     * has not yet been created, null will be wrapped instead.
     */
    private static final AtomicReference<Injector> injector = new AtomicReference<Injector>(null);

    /**
     * Creates a new instance of the Guice Injector which should be used
     * across the entire JDBC authentication extension. This function will
     * generally only be called once, but multiple invocations are possible if
     * get() is invoked several times concurrently prior to the Injector being
     * cached.
     *
     * @return
     * @throws GuacamoleException
     */
    protected abstract Injector create() throws GuacamoleException;

    /**
     * Returns a common, singleton instance of a Guice Injector, configured for
     * the injections required by the JDBC authentication extension. The result
     * of the first call to this function will be cached statically within this
     * class, and will be returned for all subsequent calls.
     *
     * @return
     *     A singleton instance of the Guice Injector used across the entire
     *     JDBC authentication extension.
     *
     * @throws GuacamoleException
     *     If the Injector cannot be created due to an error.
     */
    public Injector get() throws GuacamoleException {

        // Return existing Injector if already created
        Injector value = injector.get();
        if (value != null)
            return value;

        // Explicitly create and store new Injector only if necessary
        injector.compareAndSet(null, create());

        // Consistently return the same Injector, even if two create operations
        // happen concurrently
        return injector.get();

    }

}
