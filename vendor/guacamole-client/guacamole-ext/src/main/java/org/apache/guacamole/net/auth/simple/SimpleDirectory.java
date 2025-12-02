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

package org.apache.guacamole.net.auth.simple;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Identifiable;

/**
 * An extremely simple read-only implementation of a Directory which provides
 * access to a pre-defined Map of arbitrary objects. Any changes to the Map
 * will affect the available contents of this SimpleDirectory.
 *
 * @param <ObjectType>
 *     The type of objects stored within this SimpleDirectory.
 */
public class SimpleDirectory<ObjectType extends Identifiable>
        implements Directory<ObjectType> {

    /**
     * The Map of objects to provide access to.
     */
    private Map<String, ObjectType> objects = Collections.<String, ObjectType>emptyMap();

    /**
     * Creates a new empty SimpleDirectory which does not provide access to
     * any objects.
     */
    public SimpleDirectory() {
    }

    /**
     * Creates a new SimpleDirectory which provides access to the objects
     * contained within the given Map. The given Map will be used to back all
     * operations on the SimpleDirectory.
     *
     * @param objects
     *     The Map of objects to provide access to.
     */
    public SimpleDirectory(Map<String, ObjectType> objects) {
        this.objects = objects;
    }

    /**
     * Creates a new SimpleDirectory which provides access to the given object.
     *
     * @param object
     *     The object to provide access to.
     */
    public SimpleDirectory(ObjectType object) {
        this(Collections.singletonMap(object.getIdentifier(), object));
    }

    /**
     * Creates a new SimpleDirectory which provides access to the given
     * objects. Note that a new Map will be created to store the given objects.
     * If the objects are already available in Map form, it is more efficient
     * to use the {@link #SimpleDirectory(java.util.Map)} constructor.
     *
     * @param objects
     *     The objects that should be present in this directory.
     */
    @SafeVarargs
    public SimpleDirectory(ObjectType... objects) {
        this(Arrays.asList(objects));
    }

    /**
     * Creates a new SimpleDirectory which provides access to the
     * objects contained within the Collection. Note that a new Map will be
     * created to store the given objects. If the objects are already available
     * in Map form, it is more efficient to use the
     * {@link #SimpleDirectory(java.util.Map)} constructor.
     *
     * @param objects
     *     A Collection of all objects that should be present in this directory.
     */
    public SimpleDirectory(Collection<ObjectType> objects) {
        this.objects = new HashMap<String, ObjectType>(objects.size());
        for (ObjectType object : objects)
            this.objects.put(object.getIdentifier(), object);
    }

    /**
     * Sets the Map which backs this SimpleDirectory. Future function calls
     * which retrieve objects from this SimpleDirectory will use the provided
     * Map.
     *
     * @param objects
     *     The Map of objects to provide access to.
     */
    protected void setObjects(Map<String, ObjectType> objects) {
        this.objects = objects;
    }

    /**
     * Returns the Map which currently backs this SimpleDirectory. Changes to
     * this Map will affect future function calls that retrieve objects from
     * this SimpleDirectory.
     *
     * @return
     *     The Map of objects which currently backs this SimpleDirectory.
     */
    protected Map<String, ObjectType> getObjects() {
        return objects;
    }

    @Override
    public ObjectType get(String identifier)
            throws GuacamoleException {
        return objects.get(identifier);
    }

    @Override
    public Collection<ObjectType> getAll(Collection<String> identifiers)
            throws GuacamoleException {

        // Create collection which has an appropriate initial size
        Collection<ObjectType> foundObjects = new ArrayList<ObjectType>(identifiers.size());

        // Populate collection with matching objects
        for (String identifier : identifiers) {

            // Add the object which has the current identifier, if any
            ObjectType object = objects.get(identifier);
            if (object != null)
                foundObjects.add(object);

        }

        return foundObjects;

    }

    @Override
    public Set<String> getIdentifiers() throws GuacamoleException {
        return objects.keySet();
    }

    @Override
    public void add(ObjectType connection)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void update(ObjectType connection)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void remove(String identifier) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
