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

package org.apache.guacamole.auth.ban.status;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Tracks past authentication results, automatically blocking the IP addresses
 * of machines that repeatedly fail to authenticate.
 */
public interface AuthenticationFailureTracker {

    /**
     * Reports that an authentication request has been received, but it is
     * either not yet known whether the request has succeeded or failed. If the
     * associated address is currently being blocked, an exception will be
     * thrown.
     *
     * @param credentials
     *     The credentials associated with the authentication request.
     *
     * @throws GuacamoleException
     *     If the authentication request is being blocked due to brute force
     *     prevention rules.
     */
    void notifyAuthenticationRequestReceived(Credentials credentials)
            throws GuacamoleException;

    /**
     * Reports that an authentication request has been received and has
     * succeeded. If the associated address is currently being blocked, an
     * exception will be thrown.
     *
     * @param credentials
     *     The credentials associated with the successful authentication
     *     request.
     *
     * @throws GuacamoleException
     *     If the authentication request is being blocked due to brute force
     *     prevention rules.
     */
    void notifyAuthenticationSuccess(Credentials credentials)
            throws GuacamoleException;

    /**
     * Reports that an authentication request has been received and has
     * failed. If the associated address is currently being blocked, an
     * exception will be thrown.
     *
     * @param credentials
     *     The credentials associated with the failed authentication request.
     *
     * @throws GuacamoleException
     *     If the authentication request is being blocked due to brute force
     *     prevention rules.
     */
    void notifyAuthenticationFailed(Credentials credentials)
            throws GuacamoleException;

}
