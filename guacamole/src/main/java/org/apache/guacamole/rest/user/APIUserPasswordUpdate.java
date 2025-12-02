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
package org.apache.guacamole.rest.user;

/**
 * All the information necessary for the password update operation on a user.
 */
public class APIUserPasswordUpdate {
    
    /**
     * The old (current) password of this user.
     */
    private String oldPassword;
    
    /**
     * The new password of this user.
     */
    private String newPassword;

    /**
     * Returns the old password for this user. This password must match the
     * user's current password for the password update operation to succeed.
     *
     * @return
     *     The old password for this user.
     */
    public String getOldPassword() {
        return oldPassword;
    }

    /**
     * Set the old password for this user. This password must match the
     * user's current password for the password update operation to succeed.
     *
     * @param oldPassword
     *     The old password for this user.
     */
    public void setOldPassword(String oldPassword) {
        this.oldPassword = oldPassword;
    }

    /**
     * Returns the new password that will be assigned to this user.
     *
     * @return
     *     The new password for this user.
     */
    public String getNewPassword() {
        return newPassword;
    }

    /**
     * Set the new password that will be assigned to this user.
     *
     * @param newPassword
     *     The new password for this user.
     */
    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
