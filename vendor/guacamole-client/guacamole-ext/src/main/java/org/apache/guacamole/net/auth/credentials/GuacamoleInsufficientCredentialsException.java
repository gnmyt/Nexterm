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

/**
 * A security-related exception thrown when access is denied to a user because
 * the provided credentials are not sufficient for authentication to succeed.
 * The validity or invalidity of the given credentials is not specified, and
 * more information is needed before a decision can be made. Additional
 * information describing the form of valid credentials is provided.
 */
public class GuacamoleInsufficientCredentialsException extends GuacamoleCredentialsException {

    /**
     * Creates a new GuacamoleInsufficientCredentialsException with the given
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
    public GuacamoleInsufficientCredentialsException(String message, Throwable cause,
            CredentialsInfo credentialsInfo) {
        super(message, cause, credentialsInfo);
    }

    /**
     * Creates a new GuacamoleInsufficientCredentialsException with the given
     * message and associated credential information.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public GuacamoleInsufficientCredentialsException(String message, CredentialsInfo credentialsInfo) {
        super(message, credentialsInfo);
    }

    /**
     * Creates a new GuacamoleInsufficientCredentialsException with the given
     * cause and associated credential information.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public GuacamoleInsufficientCredentialsException(Throwable cause, CredentialsInfo credentialsInfo) {
        super(cause, credentialsInfo);
    }

}
