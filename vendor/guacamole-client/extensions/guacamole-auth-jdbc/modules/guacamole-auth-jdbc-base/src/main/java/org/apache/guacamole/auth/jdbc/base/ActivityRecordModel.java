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

package org.apache.guacamole.auth.jdbc.base;

import java.util.Date;

/**
 * A single activity record representing an arbitrary activity performed by a
 * user.
 */
public class ActivityRecordModel {

    /**
     * The ID of this object in the database, if any.
     */
    private Integer recordID;

    /**
     * The database ID of the user associated with this activity record.
     */
    private Integer userID;

    /**
     * The username of the user that performed the activity.
     */
    private String username;

    /**
     * The remote host associated with the user that performed the activity.
     */
    private String remoteHost;

    /**
     * The time the activity was initiated by the associated user.
     */
    private Date startDate;

    /**
     * The time the activity ended, or null if the end time is not known or
     * the activity is still in progress.
     */
    private Date endDate;

    /**
     * Returns the ID of this record in the database, if it exists.
     *
     * @return
     *     The ID of this record in the database, or null if this record was
     *     not retrieved from the database.
     */
    public Integer getRecordID() {
        return recordID;
    }

    /**
     * Sets the database ID of this record to the given value.
     *
     * @param recordID
     *     The ID to assign to this object.
     */
    public void setRecordID(Integer recordID) {
        this.recordID = recordID;
    }

    /**
     * Returns the database ID of the user associated with this activity
     * record.
     * 
     * @return
     *     The database ID of the user associated with this activity record.
     */
    public Integer getUserID() {
        return userID;
    }

    /**
     * Sets the database ID of the user associated with this activity record.
     *
     * @param userID
     *     The database ID of the user to associate with this activity
     *     record.
     */
    public void setUserID(Integer userID) {
        this.userID = userID;
    }

    /**
     * Returns the username of the user that performed the activity associated
     * with this record.
     * 
     * @return
     *     The username of the user that performed the activity associated with
     *     this record.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the username of the user that performed the activity associated
     * with this record.
     *
     * @param username
     *     The username of the user that performed the activity associated with
     *     this record.
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the remote host associated with the user that performed the
     * activity.
     *
     * @return
     *     The remote host associated with the user that performed the activity.
     */
    public String getRemoteHost() {
        return remoteHost;
    }

    /**
     * Sets the remote host associated with the user that performed the
     * activity.
     *
     * @param remoteHost
     *     The remote host associated with the user that performed the activity.
     */
    public void setRemoteHost(String remoteHost) {
        this.remoteHost = remoteHost;
    }

    /**
     * Returns the time the activity was initiated by the associated user.
     *
     * @return
     *     The time the activity was initiated by the associated user.
     */
    public Date getStartDate() {
        return startDate;
    }

    /**
     * Sets the time the activity was initiated by the associated user.
     *
     * @param startDate
     *     The time the activity was initiated by the associated user.
     */
    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    /**
     * Returns the time the activity ended, or null if the end time is not
     * known or the activity is still in progress.
     *
     * @return
     *     The time the activity ended, or null if the end time is not known or
     *     the activity is still in progress.
     */
    public Date getEndDate() {
        return endDate;
    }

    /**
     * Sets the time the activity ended, if known.
     *
     * @param endDate
     *     The time the activity ended, or null if the end time is not known or
     *     the activity is still in progress.
     */
    public void setEndDate(Date endDate) {
        this.endDate = endDate;
    }

}
