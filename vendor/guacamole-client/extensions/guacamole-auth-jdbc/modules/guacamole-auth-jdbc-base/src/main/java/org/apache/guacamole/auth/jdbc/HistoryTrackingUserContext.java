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

package org.apache.guacamole.auth.jdbc;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordMapper;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.DelegatingUserContext;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;

/**
 * DelegatingUserContext implementation which writes connection history records
 * when connections are established and closed.
 */
public class HistoryTrackingUserContext extends DelegatingUserContext {

    /**
     * The remote host that the user associated with the user context
     * connected from.
     */
    private final String remoteHost;

    /**
     * The connection record mapper to use when writing history entries for
     * established connections.
     */
    private final ConnectionRecordMapper connectionRecordMapper;

    /**
     * Creates a new HistoryTrackingUserContext which wraps the given
     * UserContext, allowing for tracking of connection history external to
     * this authentication provider.
     *
     * @param userContext
     *     The UserContext to wrap.
     *
     * @param remoteHost
     *     The host that the user associated with the given user context connected from.
     *
     * @param connectionRecordMapper
     *     The mapper to use when writing connection history entries to the DB.
     */
    public HistoryTrackingUserContext(UserContext userContext, String remoteHost, ConnectionRecordMapper connectionRecordMapper) {
        super(userContext);

        this.remoteHost = remoteHost;
        this.connectionRecordMapper = connectionRecordMapper;
    }

    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {
        return new HistoryTrackingConnectionDirectory(
                super.getConnectionDirectory(), self(),
                this.remoteHost, this.connectionRecordMapper);
    }

}
