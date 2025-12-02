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

import com.google.inject.Inject;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordMapper;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordModel;
import org.apache.guacamole.auth.jdbc.connection.ModeledConnectionRecord;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.DelegatingConnection;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * Connection implementation that creates a history record when the connection
 * is established, and returns a HistoryTrackingTunnel to automatically set the
 * end date when the connection is closed.
 */
public class HistoryTrackingConnection extends DelegatingConnection {

    /**
     * The current Guacamole user.
     */
    private final User currentUser;

    /**
     * The remote host that the user connected from.
     */
    private final String remoteHost;

    /**
     * The connection record mapper to use when writing history entries for
     * established connections.
     */
    private final ConnectionRecordMapper connectionRecordMapper;
    
    /**
     * The environment in which Guacamole is running.
     */
    private final Environment environment = LocalEnvironment.getInstance();

    /**
     * Creates a new HistoryConnection that wraps the given connection,
     * automatically creating a history record when the connection is
     * established, and returning a HistoryTrackingTunnel to set the end
     * date on the history entry when the connection is closed.
     *
     * @param currentUser
     *     The current Guacamole user.
     *
     * @param remoteHost
     *     The remote host that the user connected from.
     *
     * @param connection
     *     The connection to wrap.
     *
     * @param connectionRecordMapper
     *     The connection record mapper that will be used to write the connection history records.
     */
    public HistoryTrackingConnection(User currentUser, String remoteHost, Connection connection, ConnectionRecordMapper connectionRecordMapper) {
        super(connection);

        this.currentUser = currentUser;
        this.remoteHost = remoteHost;
        this.connectionRecordMapper = connectionRecordMapper;
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Create a connection record model, starting at the current date/time
        ConnectionRecordModel connectionRecordModel = new ConnectionRecordModel();
        connectionRecordModel.setStartDate(new Date());

        // Set the user information
        connectionRecordModel.setUsername(this.currentUser.getIdentifier());
        connectionRecordModel.setRemoteHost(this.remoteHost);

        // Set the connection information
        connectionRecordModel.setConnectionName(this.getDelegateConnection().getName());

        // Insert the connection history record to mark the start of this connection
        connectionRecordMapper.insert(connectionRecordModel,
                environment.getCaseSensitivity());

        // Include history record UUID as token
        ModeledConnectionRecord modeledRecord = new ModeledConnectionRecord(connectionRecordModel);
        Map<String, String> updatedTokens = new HashMap<>(tokens);
        updatedTokens.put("HISTORY_UUID", modeledRecord.getUUID().toString());

        // Connect, and wrap the tunnel for return
        GuacamoleTunnel tunnel = super.connect(info, updatedTokens);
        return new HistoryTrackingTunnel(
            tunnel, this.connectionRecordMapper, connectionRecordModel);
    }

    /**
     * Get the Connection wrapped by this HistoryTrackingConnection.
     *
     * @return
     *     The wrapped Connection.
     */
    public Connection getWrappedConnection() {
        return getDelegateConnection();
    }

}
