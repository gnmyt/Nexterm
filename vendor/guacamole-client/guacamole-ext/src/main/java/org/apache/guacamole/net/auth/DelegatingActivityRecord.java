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
 * ActivityRecord implementation which simply delegates all function calls to an
 * underlying ActivityRecord.
 */
public class DelegatingActivityRecord implements ActivityRecord {

    /**
     * The wrapped ActivityRecord.
     */
    private final ActivityRecord record;

    /**
     * Wraps the given ActivityRecord such that all function calls against this
     * DelegatingActivityRecord will be delegated to it.
     *
     * @param record
     *     The record to wrap.
     */
    public DelegatingActivityRecord(ActivityRecord record) {
        this.record = record;
    }

    /**
     * Returns the underlying ActivityRecord wrapped by this
     * DelegatingActivityRecord.
     *
     * @return
     *     The ActivityRecord wrapped by this DelegatingActivityRecord.
     */
    protected ActivityRecord getDelegateActivityRecord() {
        return record;
    }

    @Override
    public Date getStartDate() {
        return record.getStartDate();
    }

    @Override
    public Date getEndDate() {
        return record.getEndDate();
    }

    @Override
    public String getRemoteHost() {
        return record.getRemoteHost();
    }

    @Override
    public String getUsername() {
        return record.getUsername();
    }

    @Override
    public boolean isActive() {
        return record.isActive();
    }

    @Override
    public String getIdentifier() {
        return record.getIdentifier();
    }

    @Override
    public UUID getUUID() {
        return record.getUUID();
    }

    @Override
    public Map<String, ActivityLog> getLogs() {
        return record.getLogs();
    }

    @Override
    public Map<String, String> getAttributes() {
        return record.getAttributes();
    }

}
