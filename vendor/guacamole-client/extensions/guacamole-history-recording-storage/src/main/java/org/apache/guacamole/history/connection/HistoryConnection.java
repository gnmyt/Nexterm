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

package org.apache.guacamole.history.connection;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.DelegatingConnection;
import org.apache.guacamole.net.auth.User;

/**
 * Connection implementation that automatically defines ActivityLogs for
 * files that relate to history entries associated with the wrapped connection.
 */
public class HistoryConnection extends DelegatingConnection {

    /**
     * The current Guacamole user.
     */
    private final User currentUser;

    /**
     * Creates a new HistoryConnection that wraps the given connection,
     * automatically associating history entries with ActivityLogs based on
     * related files (session recordings, typescripts, etc.).
     *
     * @param currentUser
     *     The current Guacamole user.
     *
     * @param connection
     *     The connection to wrap.
     */
    public HistoryConnection(User currentUser, Connection connection) {
        super(connection);
        this.currentUser = currentUser;
    }

    /**
     * Returns the connection wrapped by this HistoryConnection.
     *
     * @return
     *     The connection wrapped by this HistoryConnection.
     */
    public Connection getWrappedConnection() {
        return getDelegateConnection();
    }

    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory() throws GuacamoleException {
        return new RecordedConnectionActivityRecordSet(currentUser, super.getConnectionHistory());
    }

}
