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

package org.apache.guacamole.auth.jdbc.permission;

import java.util.Collection;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Generic base for mappers which handle permissions.
 *
 * @param <PermissionType>
 *     The type of permission model object handled by this mapper.
 */
public interface PermissionMapper<PermissionType> {

    /**
     * Retrieves all permissions associated with the given entity (user or user
     * group).
     *
     * @param entity
     *     The entity to retrieve permissions for.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the user. If
     *     no groups are given, only permissions directly granted to the user
     *     will be used.
     * 
     * @param caseSensitivity
     *     The case sensitivity configuration for usernames and group names.
     *
     * @return
     *     All permissions associated with the given entity.
     */
    Collection<PermissionType> select(@Param("entity") EntityModel entity,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Inserts the given permissions into the database. If any permissions
     * already exist, they will be ignored.
     *
     * @param permissions 
     *     The permissions to insert.
     * 
     * @param caseSensitivity
     *     The case sensitivity configuration for usernames and group names.
     *
     * @return
     *     The number of rows inserted.
     */
    int insert(@Param("permissions") Collection<PermissionType> permissions,
               @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Deletes the given permissions from the database. If any permissions do
     * not exist, they will be ignored.
     *
     * @param permissions
     *     The permissions to delete.
     * 
     * @param caseSensitivity
     *     The case sensitivity configuration for usernames and group names.
     *
     * @return
     *     The number of rows deleted.
     */
    int delete(@Param("permissions") Collection<PermissionType> permissions,
               @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
