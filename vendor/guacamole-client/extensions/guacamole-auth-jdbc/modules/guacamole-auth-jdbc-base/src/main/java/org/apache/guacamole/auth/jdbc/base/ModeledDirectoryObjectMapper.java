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
import org.apache.guacamole.auth.jdbc.user.UserModel;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Common interface for objects that will ultimately be made available through
 * the Directory class. All such objects will need the same base set of queries
 * to fulfill the needs of the Directory class.
 *
 * @param <ModelType>
 *     The type of object contained within the directory whose objects are
 *     mapped by this mapper.
 */
public interface ModeledDirectoryObjectMapper<ModelType> {

    /**
     * Selects the identifiers of all objects, regardless of whether they
     * are readable by any particular user. This should only be called on
     * behalf of a system administrator. If identifiers are needed by a non-
     * administrative user who must have explicit read rights, use
     * selectReadableIdentifiers() instead.
     *
     * @return
     *     A Set containing all identifiers of all objects.
     */
    Set<String> selectIdentifiers();
    
    /**
     * Selects the identifiers of all objects that are explicitly readable by
     * the given user. If identifiers are needed by a system administrator
     * (who, by definition, does not need explicit read rights), use
     * selectIdentifiers() instead.
     *
     * @param user
     *    The user whose permissions should determine whether an identifier
     *    is returned.
     *
     * @param effectiveGroups
     *     The identifiers of any known effective groups that should be taken
     *     into account, such as those defined externally to the database.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     A Set containing all identifiers of all readable objects.
     */
    Set<String> selectReadableIdentifiers(@Param("user") UserModel user,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);
    
    /**
     * Selects all objects which have the given identifiers. If an identifier
     * has no corresponding object, it will be ignored. This should only be
     * called on behalf of a system administrator. If objects are needed by a
     * non-administrative user who must have explicit read rights, use
     * selectReadable() instead.
     *
     * @param identifiers
     *     The identifiers of the objects to return.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return 
     *     A Collection of all objects having the given identifiers.
     */
    Collection<ModelType> select(@Param("identifiers") Collection<String> identifiers,
                                 @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Selects all objects which have the given identifiers and are explicitly
     * readably by the given user. If an identifier has no corresponding
     * object, or the corresponding object is unreadable, it will be ignored.
     * If objects are needed by a system administrator (who, by definition,
     * does not need explicit read rights), use select() instead.
     *
     * @param user
     *    The user whose permissions should determine whether an object 
     *    is returned.
     *
     * @param identifiers
     *     The identifiers of the objects to return.
     *
     * @param effectiveGroups
     *     The identifiers of any known effective groups that should be taken
     *     into account, such as those defined externally to the database.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return 
     *     A Collection of all objects having the given identifiers.
     */
    Collection<ModelType> selectReadable(@Param("user") UserModel user,
            @Param("identifiers") Collection<String> identifiers,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Inserts the given object into the database. If the object already
     * exists, this will result in an error.
     *
     * @param object
     *     The object to insert.
     *
     * @return
     *     The number of rows inserted.
     */
    int insert(@Param("object") ModelType object);

    /**
     * Deletes the given object into the database. If the object does not 
     * exist, this operation has no effect.
     *
     * @param identifier
     *     The identifier of the object to delete.
     * 
     * @param caseSensitivity
     *     The case sensitivity configuration that contains information on
     *     whether usernames and/or group names will be treated as case-sensitive.
     *
     * @return
     *     The number of rows deleted.
     */
    int delete(@Param("identifier") String identifier,
               @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Updates the given existing object in the database. If the object does 
     * not actually exist, this operation has no effect.
     *
     * @param object
     *     The object to update.
     *
     * @return
     *     The number of rows updated.
     */
    int update(@Param("object") ModelType object);

    /**
     * Deletes any arbitrary attributes currently associated with the given
     * object in the database.
     *
     * @param object
     *     The object whose arbitrary attributes should be deleted.
     *
     * @return
     *     The number of rows deleted.
     */
    int deleteAttributes(@Param("object") ModelType object);

    /**
     * Inserts all arbitrary attributes associated with the given object.
     *
     * @param object
     *     The object whose arbitrary attributes should be inserted.
     *
     * @return
     *     The number of rows inserted.
     */
    int insertAttributes(@Param("object") ModelType object);

}
