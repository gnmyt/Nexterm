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

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;

/**
 * An arbitrary set of existing objects sharing some common relation. Unlike a
 * Directory, which provides for maintaining the entire lifecycle of its
 * objects, a RelatedObjectSet only maintains the relation between its
 * containing object and the objects within the set. Adding/removing an object
 * from a RelatedObjectSet affects only the status of the specific relationship
 * represented by the RelatedObjectSet, not the existence of the objects
 * themselves.
 */
public interface RelatedObjectSet {

    /**
     * Returns a Set which contains the identifiers of all objects contained
     * within this RelatedObjectSet.
     *
     * @return
     *     A Set which contains the identifiers of all objects contained
     *     within this RelatedObjectSet.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the objects within the set, or
     *     if objects cannot be retrieved due to lack of permissions to do so.
     */
    Set<String> getObjects() throws GuacamoleException;

    /**
     * Adds the objects having the given identifiers, if not already present.
     * If a specified object is already present, no operation is performed
     * regarding that object.
     *
     * @param identifiers
     *     The identifiers of all objects being added.
     *
     * @throws GuacamoleException
     *     If an error occurs while adding the objects, or if permission to add
     *     objects is denied.
     */
    void addObjects(Set<String> identifiers) throws GuacamoleException;

    /**
     * Removes each of the objects having the specified identifiers, if
     * present. If a specified object is not present, no operation is performed
     * regarding that object.
     *
     * @param identifiers
     *     The identifiers of all objects being removed.
     *
     * @throws GuacamoleException
     *     If an error occurs while removing the objects, or if permission to
     *     remove objects is denied.
     */
    void removeObjects(Set<String> identifiers) throws GuacamoleException;

    /**
     * An immutable instance of RelatedObjectSEt which contains no objects.
     */
    static final RelatedObjectSet EMPTY_SET = new RelatedObjectSet() {

        @Override
        public Set<String> getObjects() throws GuacamoleException {
            return Collections.emptySet();
        }

        @Override
        public void addObjects(Set<String> identifiers)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

        @Override
        public void removeObjects(Set<String> identifiers)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

    };

}
