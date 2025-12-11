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

package org.apache.guacamole.net.auth.simple;

import java.util.Collections;
import org.apache.guacamole.net.auth.User;

/**
 * An extremely simple read-only implementation of a Directory of Users which
 * provides access to a single pre-defined User.
 *
 * @deprecated Use {@link SimpleDirectory} instead.
 */
@Deprecated
public class SimpleUserDirectory extends SimpleDirectory<User> {

    /**
     * Creates a new SimpleUserDirectory which provides access to the single
     * user provided.
     *
     * @param user The user to provide access to.
     */
    public SimpleUserDirectory(User user) {
        super(Collections.singletonMap(user.getIdentifier(), user));
    }

}
