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

package org.apache.guacamole.net.auth.credentials;

import org.apache.guacamole.GuacamoleUnauthorizedException;

/**
 * A security-related exception thrown when access is denied to a user because
 * of a problem related to the provided credentials. Additional information
 * describing the form of valid credentials is provided.
 */
public class GuacamoleCredentialsException extends GuacamoleUnauthorizedException {

    /**
     * Information describing the form of valid credentials.
     */
    private final CredentialsInfo credentialsInfo;
    
    /**
     * Creates a new GuacamoleInvalidCredentialsException with the given
     * message, cause, and associated credential information.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public GuacamoleCredentialsException(String message, Throwable cause,
            CredentialsInfo credentialsInfo) {
        super(message, cause);
        this.credentialsInfo = credentialsInfo;
    }

    /**
     * Creates a new GuacamoleInvalidCredentialsException with the given
     * message and associated credential information.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public GuacamoleCredentialsException(String message, CredentialsInfo credentialsInfo) {
        super(message);
        this.credentialsInfo = credentialsInfo;
    }

    /**
     * Creates a new GuacamoleInvalidCredentialsException with the given cause
     * and associated credential information.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public GuacamoleCredentialsException(Throwable cause, CredentialsInfo credentialsInfo) {
        super(cause);
        this.credentialsInfo = credentialsInfo;
    }

    /**
     * Returns information describing the form of valid credentials.
     *
     * @return
     *     Information describing the form of valid credentials.
     */
    public CredentialsInfo getCredentialsInfo() {
        return credentialsInfo;
    }

}
