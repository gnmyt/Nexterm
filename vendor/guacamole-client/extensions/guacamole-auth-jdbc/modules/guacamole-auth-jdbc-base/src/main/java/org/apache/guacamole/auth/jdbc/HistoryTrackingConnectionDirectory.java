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
import org.apache.guacamole.net.auth.DecoratingDirectory;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;

/**
 * A connection directory that returns HistoryTrackingConnection-wrapped connections
 * when queried.
 */
public class HistoryTrackingConnectionDirectory extends DecoratingDirectory<Connection> {

    /**
     * The connection record mapper to use when writing history entries for
     * established connections.
     */
    private final ConnectionRecordMapper connectionRecordMapper;

    /**
     * The user that directory operations are being performed for.
     */
    private final User user;

    /**
     * The remote host that the user connected from.
     */
    private final String remoteHost;

    /**
     * Create a new history tracking connection directory. Any connection retrieved from this
     * directory will be wrapped in a HistoryTrackingConnection, enabling connection history
     * records to be written with the provided connection record mapper.
     *
     * @param directory
     *     The connection directory to wrap.
     *
     * @param user
     *     The user associated with the connection directory.
     *
     * @param remoteHost
     *     The remote host that the user connected from.
     *
     * @param connectionRecordMapper
     *     The connection record mapper that will be used to write the connection history records.
     */
    public HistoryTrackingConnectionDirectory(Directory<Connection> directory, User user, String remoteHost, ConnectionRecordMapper connectionRecordMapper) {
        super(directory);

        this.user = user;
        this.remoteHost = remoteHost;
        this.connectionRecordMapper = connectionRecordMapper;
    }

    @Override
    protected Connection decorate(Connection connection) throws GuacamoleException {

         // Wrap the connection in a history-tracking layer
         return new HistoryTrackingConnection(
            this.user, this.remoteHost, connection, this.connectionRecordMapper);
    }

    @Override
    protected Connection undecorate(Connection connection) throws GuacamoleException {

        // If the connection was wrapped, unwrap it
        if (connection instanceof HistoryTrackingConnection) {
            return ((HistoryTrackingConnection) connection).getWrappedConnection();
        }

        // Otherwise, return the unwrapped connection directly
        return connection;
    }

}
