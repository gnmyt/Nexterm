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

package org.apache.guacamole.auth.jdbc.activeconnection;


import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.JDBCDirectory;
import org.apache.guacamole.net.auth.ActiveConnection;

/**
 * Implementation of a Directory which contains all currently-active
 * connections.
 */
public class ActiveConnectionDirectory extends JDBCDirectory<ActiveConnection> {

    /**
     * Service for retrieving and manipulating active connections.
     */
    @Inject
    private ActiveConnectionService activeConnectionService;

    @Override
    public ActiveConnection get(String identifier) throws GuacamoleException {
        return activeConnectionService.retrieveObject(getCurrentUser(), identifier);
    }

    @Override
    public Collection<ActiveConnection> getAll(Collection<String> identifiers)
            throws GuacamoleException {
        Collection<TrackedActiveConnection> objects = activeConnectionService.retrieveObjects(getCurrentUser(), identifiers);
        return Collections.<ActiveConnection>unmodifiableCollection(objects);
    }

    @Override
    public Set<String> getIdentifiers() throws GuacamoleException {
        return activeConnectionService.getIdentifiers(getCurrentUser());
    }

    @Override
    public void add(ActiveConnection object) throws GuacamoleException {
        activeConnectionService.createObject(getCurrentUser(), object);
    }

    @Override
    public void update(ActiveConnection object) throws GuacamoleException {
        TrackedActiveConnection connection = (TrackedActiveConnection) object;
        activeConnectionService.updateObject(getCurrentUser(), connection);
    }

    @Override
    public void remove(String identifier) throws GuacamoleException {
        activeConnectionService.deleteObject(getCurrentUser(), identifier);
    }

}
