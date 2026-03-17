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

package org.apache.guacamole.rest.history;

import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.ConnectionRecord;

/**
 * A REST resource for retrieving and managing the history records of Guacamole
 * connections. Connection history records describe the start/end times of each
 * usage of a connection (when a user connects and disconnects), as well as the
 * specific user that connected/disconnected.
 */
public class ConnectionHistoryResource extends ActivityRecordSetResource<ConnectionRecord, APIConnectionRecord> {

    /**
     * Creates a new ConnectionHistoryResource which exposes the connection
     * history records of the given ActivityRecordSet.
     *
     * @param history
     *     The ActivityRecordSet whose records should be exposed.
     */
    public ConnectionHistoryResource(ActivityRecordSet<ConnectionRecord> history) {
        super(history);
    }

    @Override
    protected APIConnectionRecord toExternalRecord(ConnectionRecord record) {
        return new APIConnectionRecord(record);
    }

}
