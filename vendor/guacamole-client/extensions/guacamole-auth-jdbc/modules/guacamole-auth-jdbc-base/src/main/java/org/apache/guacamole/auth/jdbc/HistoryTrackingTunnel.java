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

import java.util.Date;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordMapper;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordModel;
import org.apache.guacamole.net.DelegatingGuacamoleTunnel;
import org.apache.guacamole.net.GuacamoleTunnel;

/**
 * Tunnel implementation which automatically writes an end date for the
 * provided connection history record model using the provided connection
 * history mapper, when the tunnel is closed.
 */
public class HistoryTrackingTunnel extends DelegatingGuacamoleTunnel {

    /**
     * The connection for which this tunnel was established.
     */
    private final ConnectionRecordMapper connectionRecordMapper;

    /**
     * The user for which this tunnel was established.
     */
    private final ConnectionRecordModel connectionRecordModel;

    /**
     * Creates a new HistoryTrackingTunnel that wraps the given tunnel,
     * automatically setting the end date for the provided connection history records,
     * using the provided connection history record mapper.
     *
     * @param tunnel
     *     The tunnel to wrap.
     *
     * @param connectionRecordMapper
     *     The mapper to use when writing connection history records.
     *
     * @param connectionRecordModel
     *     The connection history record model representing the in-progress connection.
     */
    public HistoryTrackingTunnel(GuacamoleTunnel tunnel,
            ConnectionRecordMapper connectionRecordMapper, ConnectionRecordModel connectionRecordModel) {

        super(tunnel);

        // Store the connection record mapper and model for history tracking
        this.connectionRecordMapper = connectionRecordMapper;
        this.connectionRecordModel = connectionRecordModel;
    }

    @Override
    public void close() throws GuacamoleException {

        // Set the end date to complete the connection history record
        this.connectionRecordModel.setEndDate(new Date());
        this.connectionRecordMapper.updateEndDate(this.connectionRecordModel);

        super.close();
    }

}
