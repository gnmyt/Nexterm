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

package org.apache.guacamole.auth.file;

import java.util.HashMap;
import java.util.Map;

/**
 * Mapping of all usernames to corresponding authorizations.
 */
public class UserMapping {

    /**
     * All authorizations, indexed by username.
     */
    private Map<String, Authorization> authorizations =
            new HashMap<String, Authorization>();

    /**
     * Adds the given authorization to the user mapping.
     *
     * @param authorization The authorization to add to the user mapping.
     */
    public void addAuthorization(Authorization authorization) {
        authorizations.put(authorization.getUsername(), authorization);
    }

    /**
     * Returns the authorization corresponding to the user having the given
     * username, if any.
     *
     * @param username The username to find the authorization for.
     * @return The authorization corresponding to the user having the given
     *         username, or null if no such authorization exists.
     */
    public Authorization getAuthorization(String username) {
        return authorizations.get(username);
    }

}
