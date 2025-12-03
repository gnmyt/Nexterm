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
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Mapper for system-level permissions.
 */
public interface SystemPermissionMapper extends PermissionMapper<SystemPermissionModel> {

    /**
     * Retrieve the permission of the given type associated with the given
     * entity, if it exists. If no such permission exists, null is returned.
     *
     * @param entity
     *     The entity to retrieve permissions for.
     *
     * @param type
     *     The type of permission to return.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the user. If
     *     no groups are given, only permissions directly granted to the user
     *     will be used.
     * 
     * @param caseSensitivity
     *     The case sensitivity configuration, used to determine whether usernames
     *     and/or group names will be treated as case-sensitive.
     *
     * @return
     *     The requested permission, or null if no such permission is granted
     *     to the given entity.
     */
    SystemPermissionModel selectOne(@Param("entity") EntityModel entity,
            @Param("type") SystemPermission.Type type,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
