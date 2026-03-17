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

package org.apache.guacamole.net.auth;

import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;

/**
 * Directory implementation which simply delegates all function calls to an
 * underlying Directory.
 *
 * @param <ObjectType>
 *     The type of objects stored within this Directory.
 */
public class DelegatingDirectory<ObjectType extends Identifiable>
        implements Directory<ObjectType> {

    /**
     * The wrapped Directory.
     */
    private final Directory<ObjectType> directory;

    /**
     * Wraps the given Directory such that all function calls against this
     * DelegatingDirectory will be delegated to it.
     *
     * @param directory
     *     The directory to wrap.
     */
    public DelegatingDirectory(Directory<ObjectType> directory) {
        this.directory = directory;
    }

    /**
     * Returns the underlying Directory wrapped by this DelegatingDirectory.
     *
     * @return
     *     The Directory wrapped by this DelegatingDirectory.
     */
    protected Directory<ObjectType> getDelegateDirectory() {
        return directory;
    }

    @Override
    public ObjectType get(String identifier) throws GuacamoleException {
        return directory.get(identifier);
    }

    @Override
    public Collection<ObjectType> getAll(Collection<String> identifiers)
            throws GuacamoleException {
        return directory.getAll(identifiers);
    }

    @Override
    public Set<String> getIdentifiers() throws GuacamoleException {
        return directory.getIdentifiers();
    }

    @Override
    public void add(ObjectType object) throws GuacamoleException {
        directory.add(object);
    }

    @Override
    public void update(ObjectType object) throws GuacamoleException {
        directory.update(object);
    }

    @Override
    public void remove(String identifier) throws GuacamoleException {
        directory.remove(identifier);
    }

    @Override
    public void tryAtomically(AtomicDirectoryOperation<ObjectType> operation)
            throws GuacamoleException {
        directory.tryAtomically(operation);
    }

}
