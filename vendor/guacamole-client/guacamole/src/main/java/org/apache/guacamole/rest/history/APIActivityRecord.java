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

import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.guacamole.net.auth.ActivityRecord;

/**
 * A activity record which may be exposed through the REST endpoints.
 */
public class APIActivityRecord {

    /**
     * The date and time the activity began.
     */
    private final Date startDate;

    /**
     * The date and time the activity ended, or null if the activity is
     * still in progress or if the end time is unknown.
     */
    private final Date endDate;

    /**
     * The hostname or IP address of the remote host that performed the
     * activity associated with this record, if known.
     */
    private final String remoteHost;

    /**
     * The name of the user who performed or is performing the activity
     * associated with this record.
     */
    private final String username;

    /**
     * Whether the activity is still in progress.
     */
    private final boolean active;

    /**
     * The unique identifier assigned to this record, or null if this record
     * has no such identifier.
     */
    private final String identifier;
    
    /**
     * A UUID that uniquely identifies this record, or null if no such unique
     * identifier exists.
     */
    private final UUID uuid;

    /**
     * A map of all attribute identifiers to their corresponding values, for
     * all attributes associated with this record.
     */
    private final Map<String, String> attributes;

    /**
     * A map of all logs associated and accessible via this record, associated
     * with their corresponding unique names.
     */
    private final Map<String, APIActivityLog> logs;

    /**
     * Creates a new APIActivityRecord, copying the data from the given activity
     * record.
     *
     * @param record
     *     The record to copy data from.
     */
    public APIActivityRecord(ActivityRecord record) {

        this.startDate  = record.getStartDate();
        this.endDate    = record.getEndDate();
        this.remoteHost = record.getRemoteHost();
        this.username   = record.getUsername();
        this.active     = record.isActive();
        this.identifier = record.getIdentifier();
        this.uuid       = record.getUUID();
        this.attributes = record.getAttributes();

        this.logs = record.getLogs().entrySet().stream().collect(Collectors.toMap(
                Map.Entry::getKey,
                (entry) -> new APIActivityLog(entry.getValue())
        ));

    }

    /**
     * Returns the date and time the activity began.
     *
     * @return
     *     The date and time the activity began.
     */
    public Date getStartDate() {
        return startDate;
    }

    /**
     * Returns the date and time the activity ended, if applicable.
     *
     * @return
     *     The date and time the activity ended, or null if the activity is
     *     still in progress or if the end time is unknown.
     */
    public Date getEndDate() {
        return endDate;
    }

    /**
     * Returns the hostname or IP address of the remote host that performed the
     * activity associated with this record, if known.
     *
     * @return
     *     The hostname or IP address of the remote host that performed the
     *     activity associated with this record, or null if the remote host is
     *     unknown.
     */
    public String getRemoteHost() {
        return remoteHost;
    }

    /**
     * Returns the name of the user who performed or is performing the activity
     * associated with this record.
     *
     * @return
     *     The name of the user who performed or is performing the activity
     *     associated with this record.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Returns whether the activity associated with this record is still in
     * progress.
     *
     * @return
     *     true if the activity associated with this record is still in
     *     progress, false otherwise.
     */
    public boolean isActive() {
        return active;
    }

    /**
     * Returns the unique identifier assigned to this record, if any. If this
     * record is not uniquely identifiable, this may be null.
     *
     * @return
     *     The unique identifier assigned to this record, or null if this
     *     record has no such identifier.
     */
    public String getIdentifier() {
        return identifier;
    }

    /**
     * Returns a UUID that uniquely identifies this record. If not implemented
     * by the extension exposing this history record, this may be null.
     *
     * @return
     *     A UUID that uniquely identifies this record, or null if no such
     *     unique identifier exists.
     */
    public UUID getUUID() {
        return uuid;
    }

    /**
     * Returns all attributes associated with this record.
     *
     * @return
     *     A map of all attribute identifiers to their corresponding values,
     *     for all attributes associated with this record.
     */
    public Map<String, String> getAttributes() {
        return attributes;
    }

    /**
     * Returns a Map of logs related to this record and accessible by the
     * current user, such as Guacamole session recordings. Each log is
     * associated with a corresponding, arbitrary, unique name.
     *
     * @return
     *     A Map of logs related to this record.
     */
    public Map<String, APIActivityLog> getLogs() {
        return logs;
    }

}
