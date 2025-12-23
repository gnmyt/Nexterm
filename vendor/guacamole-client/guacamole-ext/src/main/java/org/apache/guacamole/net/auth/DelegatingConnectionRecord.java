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

package org.apache.guacamole.net.auth;

import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * ConnectionRecord implementation which simply delegates all function calls to
 * an underlying ConnectionRecord.
 */
public class DelegatingConnectionRecord extends DelegatingActivityRecord
        implements ConnectionRecord {

    /**
     * The wrapped ConnectionRecord.
     */
    private final ConnectionRecord record;

    /**
     * Wraps the given ConnectionRecord such that all function calls against
     * this DelegatingConnectionRecord will be delegated to it.
     *
     * @param record
     *     The record to wrap.
     */
    public DelegatingConnectionRecord(ConnectionRecord record) {
        super(record);
        this.record = record;
    }

    /**
     * Returns the underlying ConnectionRecord wrapped by this
     * DelegatingConnectionRecord.
     *
     * @return
     *     The ConnectionRecord wrapped by this DelegatingConnectionRecord.
     */
    protected ConnectionRecord getDelegateConnectionRecord() {
        return record;
    }

    @Override
    public String getConnectionIdentifier() {
        return record.getConnectionIdentifier();
    }

    @Override
    public String getConnectionName() {
        return record.getConnectionName();
    }

    @Override
    public String getSharingProfileIdentifier() {
        return record.getSharingProfileIdentifier();
    }

    @Override
    public String getSharingProfileName() {
        return record.getSharingProfileName();
    }

}
