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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.Date;
import java.util.Map;
import org.apache.guacamole.net.auth.User;

/**
 * A simple User to expose through the REST endpoints.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(value=Include.NON_NULL)
public class APIUser {
    
    /**
     * The username of this user.
     */
    private String username;
    
    /**
     * The password of this user.
     */
    private String password;
    
    /**
     * Boolean value indicating whether or not this user account is disabled.
     */
    private boolean disabled;
    
    /**
     * Map of all associated attributes by attribute identifier.
     */
    private Map<String, String> attributes;

    /**
     * The date and time that this user was last logged in, or null if this user
     * has never logged in or this information is unavailable.
     */
    private Date lastActive;

    /**
     * Construct a new empty APIUser.
     */
    public APIUser() {}
    
    /**
     * Construct a new APIUser from the provided User.
     * 
     * @param user
     *     The User to construct the APIUser from.
     */
    public APIUser(User user) {

        // Set user information
        this.username = user.getIdentifier();
        this.password = user.getPassword();
        this.lastActive = user.getLastActive();
        this.disabled = user.isDisabled();

        // Associate any attributes
        this.attributes = user.getAttributes();

    }

    /**
     * Returns the username for this user.
     * 
     * @return
     *     The username for this user. 
     */
    public String getUsername() {
        return username;
    }

    /**
     * Set the username for this user.
     * 
     * @param username
     *     The username for this user.
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the password for this user.
     * 
     * @return
     *     The password for this user.
     */
    public String getPassword() {
        return password;
    }

    /**
     * Set the password for this user.
     * 
     * @param password
     *     The password for this user.
     */
    public void setPassword(String password) {
        this.password = password;
    }
    
    /**
     * Returns true if this user account is disabled, otherwise false.
     * 
     * @return 
     *     True if this user account is disabled, otherwise false.
     */
    public boolean isDisabled() {
        return disabled;
    }
    
    /**
     * Sets the disabled status of this user account, disabling the account
     * if set to true.
     * 
     * @param disabled 
     *     True if this user account should be disabled.
     */
    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
    }

    /**
     * Returns a map of all attributes associated with this user. Each entry
     * key is the attribute identifier, while each value is the attribute
     * value itself.
     *
     * @return
     *     The attribute map for this user.
     */
    public Map<String, String> getAttributes() {
        return attributes;
    }

    /**
     * Sets the map of all attributes associated with this user. Each entry key
     * is the attribute identifier, while each value is the attribute value
     * itself.
     *
     * @param attributes
     *     The attribute map for this user.
     */
    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes;
    }

    /**
     * Returns the date and time that this user was last logged in, or null if
     * this user has never logged in or this information is unavailable.
     *
     * @return
     *     The date and time that this user was last logged in, or null if this
     *     user has never logged in or this information is unavailable.
     */
    public Date getLastActive() {
        return lastActive;
    }

    /**
     * Sets the date and time that this user was last logged in.
     *
     * @param lastActive
     *     The date and time that this user was last logged in, or null if this
     *     user has never logged in or this information is unavailable.
     */
    public void setLastActive(Date lastActive) {
        this.lastActive = lastActive;
    }

}
