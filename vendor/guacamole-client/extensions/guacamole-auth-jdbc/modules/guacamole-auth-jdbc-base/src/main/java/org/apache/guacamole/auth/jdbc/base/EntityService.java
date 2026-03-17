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

import com.google.inject.Inject;
import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.session.SqlSession;
import org.mybatis.guice.transactional.Transactional;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating entities.
 */
public class EntityService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Mapper for Entity model objects.
     */
    @Inject
    private EntityMapper entityMapper;

    /**
     * The current SQL session used by MyBatis.
     */
    @Inject
    private SqlSession sqlSession;

    /**
     * Returns the set of all group identifiers of which the given entity is a
     * member, taking into account the given collection of known group
     * memberships which are not necessarily defined within the database.
     * 
     * Note that group visibility with respect to the queried entity is NOT
     * taken into account. If the entity is a member of a group, the identifier
     * of that group will be included in the returned set even if the current
     * user lacks "READ" permission for that group.
     *
     * @param entity
     *     The entity whose effective groups should be returned.
     *
     * @param effectiveGroups
     *     The identifiers of any known effective groups that should be taken
     *     into account, such as those defined externally to the database.
     *
     * @return
     *     The set of identifiers of all groups that the given entity is a
     *     member of, including those where membership is inherited through
     *     membership in other groups.
     */
    @Transactional
    public Set<String> retrieveEffectiveGroups(ModeledPermissions<? extends EntityModel> entity,
            Collection<String> effectiveGroups) {

        CaseSensitivity caseSensitivity = environment.getCaseSensitivity();

        // Retrieve the effective user groups of the given entity, recursively if possible
        boolean recursive = environment.isRecursiveQuerySupported(sqlSession);
        Set<String> identifiers = entityMapper.selectEffectiveGroupIdentifiers(
                entity.getModel(), effectiveGroups, recursive, caseSensitivity);

        // If the set of user groups retrieved was not produced recursively,
        // manually repeat the query to expand the set until all effective
        // groups have been found
        if (!recursive && !identifiers.isEmpty()) {
            Set<String> previousIdentifiers;
            do {
                previousIdentifiers = identifiers;
                identifiers = entityMapper.selectEffectiveGroupIdentifiers(
                        entity.getModel(), previousIdentifiers, false,
                        caseSensitivity);
            } while (identifiers.size() > previousIdentifiers.size());
        }

        return identifiers;

    }

}
