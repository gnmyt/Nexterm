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

package org.apache.guacamole.event;

import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.event.UserEvent;

/**
 * Loggable representation of the user that requested an operation.
 */
public class RequestingUser implements LoggableDetail {

    /**
     * The event representing the requested operation.
     */
    private final UserEvent event;

    /**
     * Creates a new RequestingUser that represents the user that requested the
     * operation described by the given event.
     *
     * @param event
     *     The event representing the requested operation.
     */
    public RequestingUser(UserEvent event) {
        this.event = event;
    }

    @Override
    public String toString() {

        AuthenticatedUser user = event.getAuthenticatedUser();
        String identifier = user.getIdentifier();

        if (AuthenticatedUser.ANONYMOUS_IDENTIFIER.equals(identifier))
            return "Anonymous user (authenticated by \"" + user.getAuthenticationProvider().getIdentifier() + "\")";

        return "User \"" + identifier + "\" (authenticated by \"" + user.getAuthenticationProvider().getIdentifier() + "\")";
        
    }

}
