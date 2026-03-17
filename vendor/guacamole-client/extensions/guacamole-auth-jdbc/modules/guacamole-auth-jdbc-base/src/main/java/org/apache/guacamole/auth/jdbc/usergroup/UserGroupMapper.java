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

package org.apache.guacamole.auth.jdbc.usergroup;

import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectMapper;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Mapper for user group objects.
 */
public interface UserGroupMapper extends ModeledDirectoryObjectMapper<UserGroupModel> {

    /**
     * Returns the group having the given name, if any. If no such group
     * exists, null is returned.
     *
     * @param name
     *     The name of the group to return.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     The group having the given name, or null if no such group exists.
     */
    UserGroupModel selectOne(@Param("name") String name,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
