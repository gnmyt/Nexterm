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

package org.apache.guacamole.rest.auth;

import org.apache.guacamole.GuacamoleSession;

/**
 * Represents a mapping of auth token to Guacamole session for the REST 
 * authentication system.
 */
public interface TokenSessionMap {
    
    /**
     * Registers that a user has just logged in with the specified authToken and
     * GuacamoleSession.
     * 
     * @param authToken The authentication token for the logged in user.
     * @param session The GuacamoleSession for the logged in user.
     */
    public void put(String authToken, GuacamoleSession session);
    
    /**
     * Get the GuacamoleSession for a logged in user. If the auth token does not
     * represent a user who is currently logged in, returns null. 
     * 
     * @param authToken The authentication token for the logged in user.
     * @return The GuacamoleSession for the given auth token, if the auth token
     *         represents a currently logged in user, null otherwise.
     */
    public GuacamoleSession get(String authToken);

    /**
     * Removes the GuacamoleSession associated with the given auth token.
     *
     * @param authToken The token to remove.
     * @return The GuacamoleSession for the given auth token, if the auth token
     *         represents a currently logged in user, null otherwise.
     */
    public GuacamoleSession remove(String authToken);
    
    /**
     * Shuts down this session map, disallowing future sessions and reclaiming
     * any resources.
     */
    public void shutdown();
    
}
