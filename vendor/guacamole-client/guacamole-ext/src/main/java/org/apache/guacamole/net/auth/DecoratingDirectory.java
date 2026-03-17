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

import java.util.ArrayList;
import java.util.Collection;
import org.apache.guacamole.GuacamoleException;

/**
 * Directory implementation which simplifies decorating the objects within an
 * underlying Directory. The decorate() and undecorate() functions must be
 * implemented to define how each object is decorated, and how that decoration
 * may be removed.
 *
 * @param <ObjectType>
 *     The type of objects stored within this Directory.
 */
public abstract class DecoratingDirectory<ObjectType extends Identifiable>
        extends DelegatingDirectory<ObjectType> {

    /**
     * Creates a new DecoratingDirectory which decorates the objects within
     * the given directory.
     *
     * @param directory
     *     The Directory whose objects are being decorated.
     */
    public DecoratingDirectory(Directory<ObjectType> directory) {
        super(directory);
    }

    /**
     * Given an object retrieved from a Directory which originates from a
     * different AuthenticationProvider, returns an identical type of object
     * optionally wrapped with additional information, functionality, etc. If
     * this directory chooses to decorate the object provided, it is up to the
     * implementation of that decorated object to properly pass through
     * operations as appropriate, as well as provide for an eventual
     * undecorate() operation. All objects retrieved from this
     * DecoratingDirectory will first be passed through this function.
     *
     * @param object
     *     An object from a Directory which originates from a different
     *     AuthenticationProvider.
     *
     * @return
     *     An object which may have been decorated by this
     *     DecoratingDirectory. If the object was not decorated, the original,
     *     unmodified object may be returned instead.
     *
     * @throws GuacamoleException
     *     If the provided object cannot be decorated due to an error.
     */
    protected abstract ObjectType decorate(ObjectType object)
            throws GuacamoleException;

    /**
     * Given an object originally returned from a call to this
     * DecoratingDirectory's decorate() function, reverses the decoration
     * operation, returning the original object. This function is effectively
     * the exact inverse of the decorate() function. The return value of
     * undecorate(decorate(X)) must be identically X. All objects given to this
     * DecoratingDirectory via add() or update() will first be passed through
     * this function.
     *
     * @param object
     *     An object which was originally returned by a call to this
     *     DecoratingDirectory's decorate() function.
     *
     * @return
     *     The original object which was provided to this DecoratingDirectory's
     *     decorate() function.
     *
     * @throws GuacamoleException
     *     If the provided object cannot be undecorated due to an error.
     */
    protected abstract ObjectType undecorate(ObjectType object)
            throws GuacamoleException;

    @Override
    public ObjectType get(String identifier) throws GuacamoleException {

        // Decorate only if object exists
        ObjectType object = super.get(identifier);
        if (object != null)
            return decorate(object);

        return null;

    }

    @Override
    public Collection<ObjectType> getAll(Collection<String> identifiers)
            throws GuacamoleException {

        Collection<ObjectType> objects = super.getAll(identifiers);

        // Decorate all retrieved objects, if any
        Collection<ObjectType> decorated = new ArrayList<ObjectType>(objects.size());
        for (ObjectType object : objects)
            decorated.add(decorate(object));

        return decorated;

    }

    @Override
    public void add(ObjectType object) throws GuacamoleException {
        super.add(decorate(object));
    }

    @Override
    public void update(ObjectType object) throws GuacamoleException {
        super.update(undecorate(object));
    }

}
