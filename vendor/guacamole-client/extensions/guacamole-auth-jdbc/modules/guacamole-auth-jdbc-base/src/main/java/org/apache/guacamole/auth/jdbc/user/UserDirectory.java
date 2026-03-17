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

package org.apache.guacamole.auth.jdbc.user;


import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.JDBCDirectory;
import org.apache.guacamole.net.auth.User;
import org.mybatis.guice.transactional.Transactional;

/**
 * Implementation of the User Directory which is driven by an underlying,
 * arbitrary database.
 */
public class UserDirectory extends JDBCDirectory<User> {

    /**
     * Service for managing user objects.
     */
    @Inject
    private UserService userService;

    @Override
    public User get(String identifier) throws GuacamoleException {
        return userService.retrieveObject(getCurrentUser(), identifier);
    }

    @Override
    @Transactional
    public Collection<User> getAll(Collection<String> identifiers) throws GuacamoleException {
        Collection<ModeledUser> objects = userService.retrieveObjects(getCurrentUser(), identifiers);
        return Collections.<User>unmodifiableCollection(objects);
    }

    @Override
    @Transactional
    public Set<String> getIdentifiers() throws GuacamoleException {
        return userService.getIdentifiers(getCurrentUser());
    }

    @Override
    @Transactional
    public void add(User object) throws GuacamoleException {
        userService.createObject(getCurrentUser(), object);
    }

    @Override
    @Transactional
    public void update(User object) throws GuacamoleException {
        ModeledUser user = (ModeledUser) object;
        userService.updateObject(getCurrentUser(), user);
    }

    @Override
    @Transactional
    public void remove(String identifier) throws GuacamoleException {
        userService.deleteObject(getCurrentUser(), identifier);
    }

}
