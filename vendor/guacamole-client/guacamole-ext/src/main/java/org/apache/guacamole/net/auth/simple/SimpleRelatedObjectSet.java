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

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.RelatedObjectSet;

/**
 * A read-only implementation of RelatedObjectSet which uses a backing Set
 * of identifiers to determine which objects are present.
 */
public class SimpleRelatedObjectSet implements RelatedObjectSet {

    /**
     * A set containing the identifiers of all objects currently present.
     */
    private Set<String> identifiers = Collections.emptySet();

    /**
     * Creates a new empty SimpleRelatedObjectSet. If you are not extending
     * SimpleRelatedObjectSet and only need an immutable, empty
     * RelatedObjectSet, consider using {@link RelatedObjectSet#EMPTY_SET}
     * instead.
     */
    public SimpleRelatedObjectSet() {
    }

    /**
     * Creates a new SimpleRelatedObjectSet which contains the objects having
     * the identifiers within the given Set. The given Set backs the contents
     * of the new SimpleRelatedObjectSet. While the SimpleRelatedObjectSet is
     * read-only, any changes to the underlying Set will be reflected in the
     * SimpleRelatedObjectSet.
     *
     * @param identifiers
     *     The Set containing the identifiers of all objects which should be
     *     present within the new SimpleRelatedObjectSet.
     */
    public SimpleRelatedObjectSet(Set<String> identifiers) {
        this.identifiers = identifiers;
    }

    /**
     * Replaces the Set of object identifiers which backs this
     * SimpleRelatedObjectSet. Future function calls on this
     * SimpleRelatedObjectSet will instead use the provided Set.
     *
     * @param identifiers
     *     The Set containing the identifiers of all objects which should be
     *     present within this SimpleRelatedObjectSet.
     */
    protected void setObjects(Set<String> identifiers) {
        this.identifiers = identifiers;
    }

    @Override
    public Set<String> getObjects() {
        return identifiers;
    }

    @Override
    public void addObjects(Set<String> identifiers) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void removeObjects(Set<String> identifiers) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
