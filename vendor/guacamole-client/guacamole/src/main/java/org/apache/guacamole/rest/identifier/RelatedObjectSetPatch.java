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

package org.apache.guacamole.rest.identifier;

import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.RelatedObjectSet;

/**
 * A set of changes to be applied to a RelatedObjectSet, describing the
 * objects being added and/or removed.
 */
public class RelatedObjectSetPatch {

    /**
     * A set containing the identifiers of all objects being added.
     */
    private final Set<String> addedObjects = new HashSet<String>();

    /**
     * A set containing the identifiers of all objects being removed.
     */
    private final Set<String> removedObjects = new HashSet<String>();

    /**
     * Queues the object having the given identifier for addition to the
     * underlying RelatedObjectSet. The add operation will be performed only
     * when apply() is called.
     *
     * @param identifier
     *     The identifier of the object to add.
     */
    public void addObject(String identifier) {
        addedObjects.add(identifier);
    }

    /**
     * Queues the object having the given identifier for removal from the
     * underlying RelatedObjectSet. The remove operation will be performed only
     * when apply() is called.
     *
     * @param identifier
     *     The identifier of the object to remove.
     */
    public void removeObject(String identifier) {
        removedObjects.add(identifier);
    }

    /**
     * Applies all queued changes to the given RelatedObjectSet.
     *
     * @param objects
     *     The RelatedObjectSet to add and/or remove objects from.
     *
     * @throws GuacamoleException
     *     If any add or remove operation is disallowed by the underlying
     *     RelatedObjectSet.
     */
    public void apply(RelatedObjectSet objects) throws GuacamoleException {

        // Add any added identifiers
        if (!addedObjects.isEmpty())
            objects.addObjects(addedObjects);

        // Remove any removed identifiers
        if (!removedObjects.isEmpty())
            objects.removeObjects(removedObjects);

    }

}
