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

package org.apache.guacamole.rest.directory;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Identifiable;

/**
 * Directory implementation which represents a read-only subset of another
 * existing Directory. Access is provided only to a limited set of objects,
 * determined by the set of identifiers provided when the DirectoryView is
 * created.
 *
 * @param <ObjectType>
 *     The type of objects accessible through this DirectoryView.
 */
public class DirectoryView<ObjectType extends Identifiable>
        implements Directory<ObjectType> {

    /**
     * The Directory from which the given set of objects will be retrieved.
     */
    private final Directory<ObjectType> directory;

    /**
     * The set of identifiers representing the restricted set of objects that
     * this DirectoryView should provide access to.
     */
    private final Set<String> identifiers;

    /**
     * Creates a new DirectoryView which provides access to a read-only subset
     * of the objects in the given Directory. Only objects whose identifiers
     * are within the provided set will be accessible.
     *
     * @param directory
     *     The Directory of which this DirectoryView represents a subset.
     *
     * @param identifiers
     *     The identifiers of all objects which should be accessible through
     *     this DirectoryView. Objects which do not have identifiers within
     *     the provided set will be inaccessible.
     */
    public DirectoryView(Directory<ObjectType> directory,
            Set<String> identifiers) {
        this.directory = directory;
        this.identifiers = identifiers;
    }

    @Override
    public ObjectType get(String identifier) throws GuacamoleException {

        // Attempt to retrieve the requested object ONLY if it's within the
        // originally-specified subset
        if (!identifiers.contains(identifier))
            return null;

        // Delegate to underlying directory
        return directory.get(identifier);

    }

    @Override
    public Collection<ObjectType> getAll(Collection<String> identifiers)
            throws GuacamoleException {

        // Reduce requested identifiers to only those which occur within the
        // originally-specified subset
        identifiers = new ArrayList<String>(identifiers);
        identifiers.retainAll(this.identifiers);

        // Delegate to underlying directory
        return directory.getAll(identifiers);

    }

    @Override
    public Set<String> getIdentifiers() throws GuacamoleException {
        return identifiers;
    }

    @Override
    public void add(ObjectType object) throws GuacamoleException {
        throw new GuacamoleUnsupportedException("Directory view is read-only");
    }

    @Override
    public void update(ObjectType object) throws GuacamoleException {
        throw new GuacamoleUnsupportedException("Directory view is read-only");
    }

    @Override
    public void remove(String identifier) throws GuacamoleException {
        throw new GuacamoleUnsupportedException("Directory view is read-only");
    }

}
