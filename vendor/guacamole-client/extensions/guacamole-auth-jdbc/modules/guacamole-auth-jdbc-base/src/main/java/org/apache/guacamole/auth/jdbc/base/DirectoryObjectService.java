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

package org.apache.guacamole.auth.jdbc.base;

import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.GuacamoleException;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating objects that have unique identifiers, such as the objects
 * within directories. This service will automatically enforce the permissions
 * of the current user.
 *
 * @param <InternalType>
 *     The specific internal implementation of the type of object this service
 *     provides access to.
 *
 * @param <ExternalType>
 *     The external interface or implementation of the type of object this
 *     service provides access to, as defined by the guacamole-ext API.
 */
public interface DirectoryObjectService<InternalType, ExternalType> {

    /**
     * Retrieves the single object that has the given identifier, if it exists
     * and the user has permission to read it.
     *
     * @param user
     *     The user retrieving the object.
     *
     * @param identifier
     *     The identifier of the object to retrieve.
     *
     * @return
     *     The object having the given identifier, or null if no such object
     *     exists.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the requested object.
     */
    InternalType retrieveObject(ModeledAuthenticatedUser user, String identifier)
            throws GuacamoleException;
    
    /**
     * Retrieves all objects that have the identifiers in the given collection.
     * Only objects that the user has permission to read will be returned.
     *
     * @param user
     *     The user retrieving the objects.
     *
     * @param identifiers
     *     The identifiers of the objects to retrieve.
     *
     * @return
     *     The objects having the given identifiers.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the requested objects.
     */
    Collection<InternalType> retrieveObjects(ModeledAuthenticatedUser user,
            Collection<String> identifiers) throws GuacamoleException;

    /**
     * Creates the given object. If the object already exists, an error will be
     * thrown.
     *
     * @param user
     *     The user creating the object.
     *
     * @param object
     *     The object to create.
     *
     * @return
     *     The newly-created object.
     *
     * @throws GuacamoleException
     *     If the user lacks permission to create the object, or an error
     *     occurs while creating the object.
     */
    InternalType createObject(ModeledAuthenticatedUser user, ExternalType object)
            throws GuacamoleException;

    /**
     * Deletes the object having the given identifier. If no such object
     * exists, this function has no effect.
     *
     * @param user
     *     The user deleting the object.
     *
     * @param identifier
     *     The identifier of the object to delete.
     *
     * @throws GuacamoleException
     *     If the user lacks permission to delete the object, or an error
     *     occurs while deleting the object.
     */
    void deleteObject(ModeledAuthenticatedUser user, String identifier)
        throws GuacamoleException;

    /**
     * Updates the given object, applying any changes that have been made. If
     * no such object exists, this function has no effect.
     *
     * @param user
     *     The user updating the object.
     *
     * @param object
     *     The object to update.
     *
     * @throws GuacamoleException
     *     If the user lacks permission to update the object, or an error
     *     occurs while updating the object.
     */
    void updateObject(ModeledAuthenticatedUser user, InternalType object)
            throws GuacamoleException;

    /**
     * Returns the set of all identifiers for all objects that the user has
     * read access to.
     *
     * @param user
     *     The user retrieving the identifiers.
     *
     * @return
     *     The set of all identifiers for all objects.
     *
     * @throws GuacamoleException
     *     If an error occurs while reading identifiers.
     */
    Set<String> getIdentifiers(ModeledAuthenticatedUser user) throws GuacamoleException;

}
