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

import java.util.Collections;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * A logging record describing when a user started and ended a particular
 * activity.
 */
public interface ActivityRecord extends ReadableAttributes {

    /**
     * Returns the date and time the activity began.
     *
     * @return
     *     The date and time the activity began.
     */
    public Date getStartDate();

    /**
     * Returns the date and time the activity ended, if applicable.
     *
     * @return
     *     The date and time the activity ended, or null if the activity is
     *     still ongoing or if the end time is unknown.
     */
    public Date getEndDate();

    /**
     * Returns the hostname or IP address of the remote host that performed the
     * activity associated with this record, if known. If the hostname or IP
     * address is not known, null is returned.
     *
     * @return
     *     The hostname or IP address of the remote host, or null if this
     *     information is not available.
     */
    public String getRemoteHost();

    /**
     * Returns the name of the user who performed or is performing the activity
     * at the times given by this record.
     *
     * @return
     *     The name of the user who performed or is performing the associated
     *     activity.
     */
    public String getUsername();

    /**
     * Returns whether the activity associated with this record is still
     * ongoing.
     *
     * @return
     *     true if the activity associated with this record is still ongoing,
     *     false otherwise.
     */
    public boolean isActive();

    /**
     * Returns the unique identifier assigned to this record, if any. If this
     * record is not uniquely identifiable, this may be null. If provided, this
     * unique identifier MUST be unique across all {@link ActivityRecord}
     * objects within the same {@link ActivityRecordSet}.
     *
     * @return
     *     The unique identifier assigned to this record, or null if this
     *     record has no such identifier.
     */
    public default String getIdentifier() {
        UUID uuid = getUUID();
        return uuid != null ? uuid.toString() : null;
    }

    /**
     * Returns a UUID that uniquely identifies this record. If provided, this
     * UUID MUST be deterministic and unique across all {@link ActivityRecord}
     * objects within the same {@link ActivityRecordSet}, and SHOULD be unique
     * across all {@link ActivityRecord} objects.
     *
     * @return
     *     A UUID that uniquely identifies this record, or null if no such
     *     unique identifier exists.
     */
    public default UUID getUUID() {
        return null;
    }

    /**
     * Returns a Map of logs related to this record and accessible by the
     * current user, such as Guacamole session recordings. Each log is
     * associated with a corresponding, arbitrary, unique name. If the user
     * does not have access to any logs, or if no logs are available, this may
     * be an empty map.
     *
     * @return
     *     A Map of logs related to this record.
     */
    public default Map<String, ActivityLog> getLogs() {
        return Collections.emptyMap();
    }

    @Override 
    public default Map<String, String> getAttributes() {
        return Collections.emptyMap();
    }

}
