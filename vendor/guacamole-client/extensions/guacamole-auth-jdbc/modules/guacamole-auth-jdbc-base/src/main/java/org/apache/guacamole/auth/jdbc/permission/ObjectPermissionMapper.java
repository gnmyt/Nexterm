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
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Mapper for object-related permissions.
 */
public interface ObjectPermissionMapper extends PermissionMapper<ObjectPermissionModel> {

    /**
     * Retrieve the permission of the given type associated with the given
     * entity and object, if it exists. If no such permission exists, null is
     * returned.
     *
     * @param entity
     *     The entity to retrieve permissions for.
     *
     * @param type
     *     The type of permission to return.
     *
     * @param identifier
     *     The identifier of the object affected by the permission to return.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the user. If
     *     no groups are given, only permissions directly granted to the user
     *     will be used.
     * 
     * @param caseSensitivity
     *     The configuration of case sensitivity, used to determine whether
     *     usernames and/or group names will be treated as case-sensitive.
     *
     * @return
     *     The requested permission, or null if no such permission is granted
     *     to the given entity for the given object.
     */
    ObjectPermissionModel selectOne(@Param("entity") EntityModel entity,
            @Param("type") ObjectPermission.Type type,
            @Param("identifier") String identifier,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Retrieves the subset of the given identifiers for which the given entity
     * has at least one of the given permissions.
     *
     * @param entity
     *     The entity to check permissions of.
     *
     * @param permissions
     *     The permissions to check. An identifier will be included in the
     *     resulting collection if at least one of these permissions is granted
     *     for the associated object
     *
     * @param identifiers
     *     The identifiers of the objects affected by the permissions being
     *     checked.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the user. If
     *     no groups are given, only permissions directly granted to the user
     *     will be used.
     * 
     * @param caseSensitivity
     *     The configuration of case sensitivity, used to determine whether
     *     usernames and/or group names will be treated as case-sensitive.
     *
     * @return
     *     A collection containing the subset of identifiers for which at least
     *     one of the specified permissions is granted.
     */
    Collection<String> selectAccessibleIdentifiers(@Param("entity") EntityModel entity,
            @Param("permissions") Collection<ObjectPermission.Type> permissions,
            @Param("identifiers") Collection<String> identifiers,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
