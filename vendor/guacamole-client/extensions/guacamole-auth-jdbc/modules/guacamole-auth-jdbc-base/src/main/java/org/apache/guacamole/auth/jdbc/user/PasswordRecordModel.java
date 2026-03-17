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

package org.apache.guacamole.auth.jdbc.user;

import java.sql.Timestamp;

/**
 * A single password record representing a previous password of a particular
 * user, along with the time/date that password was set.
 */
public class PasswordRecordModel {

    /**
     * The database ID of the user associated with this password record.
     */
    private Integer userID;

    /**
     * The hash of the password and salt.
     */
    private byte[] passwordHash;

    /**
     * The random salt that was appended to the password prior to hashing.
     */
    private byte[] passwordSalt;

    /**
     * The date and time when this password was first set for the associated
     * user.
     */
    private Timestamp passwordDate;

    /**
     * Creates a new, empty PasswordRecordModel.
     */
    public PasswordRecordModel() {
    }

    /**
     * Creates a new PasswordRecordModel associated with the given user and
     * populated with that user's password hash and salt.
     *
     * @param user
     *     The user to associate with this PasswordRecordModel.
     */
    public PasswordRecordModel(UserModel user) {
        this.userID = user.getObjectID();
        this.passwordHash = user.getPasswordHash();
        this.passwordSalt = user.getPasswordSalt();
        this.passwordDate = user.getPasswordDate();
    }

    /**
     * Returns the database ID of the user associated with this password
     * record.
     *
     * @return
     *     The database ID of the user associated with this password record.
     */
    public Integer getUserID() {
        return userID;
    }

    /**
     * Sets the database ID of the user associated with this password record.
     *
     * @param userID
     *     The database ID of the user to associate with this password
     *     record.
     */
    public void setUserID(Integer userID) {
        this.userID = userID;
    }

    /**
     * Returns the hash of the password and password salt.
     *
     * @return
     *     The hash of the password and password salt.
     */
    public byte[] getPasswordHash() {
        return passwordHash;
    }

    /**
     * Sets the hash of the password and password salt.
     *
     * @param passwordHash
     *     The hash of the password and password salt.
     */
    public void setPasswordHash(byte[] passwordHash) {
        this.passwordHash = passwordHash;
    }

    /**
     * Returns the random salt that was used when generating the password hash.
     *
     * @return
     *     The random salt that was used when generating the password hash.
     */
    public byte[] getPasswordSalt() {
        return passwordSalt;
    }

    /**
     * Sets the random salt that was used when generating the password hash.
     *
     * @param passwordSalt
     *     The random salt used when generating the password hash.
     */
    public void setPasswordSalt(byte[] passwordSalt) {
        this.passwordSalt = passwordSalt;
    }

    /**
     * Returns the date that this password was first set for the associated
     * user.
     *
     * @return
     *     The date that this password was first set for the associated user.
     */
    public Timestamp getPasswordDate() {
        return passwordDate;
    }

    /**
     * Sets the date that this password was first set for the associated user.
     *
     * @param passwordDate
     *     The date that this password was first set for the associated user.
     */
    public void setPasswordDate(Timestamp passwordDate) {
        this.passwordDate = passwordDate;
    }

}
