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
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Mapper for entities. An entity is the base concept behind a user or user
 * group, and serves as a common point for granting permissions and defining
 * group membership.
 */
public interface EntityMapper {

    /**
     * Inserts the given entity into the database. If the entity already
     * exists, this will result in an error.
     *
     * @param entity
     *     The entity to insert.
     *
     * @return
     *     The number of rows inserted.
     */
    int insert(@Param("entity") EntityModel entity);

    /**
     * Returns the set of all group identifiers of which the given entity is a
     * member, taking into account the given collection of known group
     * memberships which are not necessarily defined within the database.
     *
     * NOTE: This query is expected to handle recursion through the membership
     * graph on its own. If the database engine does not support recursive
     * queries (isRecursiveQuerySupported() of JDBCEnvironment returns false),
     * then this query will only return one level of depth past the effective
     * groups given and will need to be invoked multiple times.
     *
     * @param entity
     *     The entity whose effective groups should be returned.
     *
     * @param effectiveGroups
     *     The identifiers of any known effective groups that should be taken
     *     into account, such as those defined externally to the database.
     *
     * @param recursive
     *     Whether the query should leverage database engine features to return
     *     absolutely all effective groups, including those inherited through
     *     group membership. If false, this query will return only one level of
     *     depth and may need to be executed multiple times. If it is known
     *     that the database engine in question will always support (or always
     *     not support) recursive queries, this parameter may be ignored.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     The set of identifiers of all groups that the given entity is a
     *     member of, including those where membership is inherited through
     *     membership in other groups.
     */
    Set<String> selectEffectiveGroupIdentifiers(@Param("entity") EntityModel entity,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("recursive") boolean recursive,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
