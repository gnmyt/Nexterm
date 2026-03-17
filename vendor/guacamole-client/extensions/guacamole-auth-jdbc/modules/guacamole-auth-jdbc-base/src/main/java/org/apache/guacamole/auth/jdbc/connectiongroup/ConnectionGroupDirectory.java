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

package org.apache.guacamole.auth.jdbc.connectiongroup;


import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.JDBCDirectory;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.mybatis.guice.transactional.Transactional;

/**
 * Implementation of the ConnectionGroup Directory which is driven by an
 * underlying, arbitrary database.
 */
public class ConnectionGroupDirectory extends JDBCDirectory<ConnectionGroup> {

    /**
     * Service for managing connection group objects.
     */
    @Inject
    private ConnectionGroupService connectionGroupService;

    @Override
    public ConnectionGroup get(String identifier) throws GuacamoleException {
        return connectionGroupService.retrieveObject(getCurrentUser(), identifier);
    }

    @Override
    @Transactional
    public Collection<ConnectionGroup> getAll(Collection<String> identifiers) throws GuacamoleException {
        Collection<ModeledConnectionGroup> objects = connectionGroupService.retrieveObjects(getCurrentUser(), identifiers);
        return Collections.<ConnectionGroup>unmodifiableCollection(objects);
    }

    @Override
    @Transactional
    public Set<String> getIdentifiers() throws GuacamoleException {
        return connectionGroupService.getIdentifiers(getCurrentUser());
    }

    @Override
    @Transactional
    public void add(ConnectionGroup object) throws GuacamoleException {
        connectionGroupService.createObject(getCurrentUser(), object);
    }

    @Override
    @Transactional
    public void update(ConnectionGroup object) throws GuacamoleException {
        ModeledConnectionGroup connectionGroup = (ModeledConnectionGroup) object;
        connectionGroupService.updateObject(getCurrentUser(), connectionGroup);
    }

    @Override
    @Transactional
    public void remove(String identifier) throws GuacamoleException {
        connectionGroupService.deleteObject(getCurrentUser(), identifier);
    }

}
