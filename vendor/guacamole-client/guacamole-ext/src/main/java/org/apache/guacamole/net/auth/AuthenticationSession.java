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

/**
 * Representation of an in-progress authentication attempt.
 */
public class AuthenticationSession {

    /**
     * The absolute point in time after which this authentication session is
     * invalid. This value is a UNIX epoch timestamp, as may be returned by
     * {@link System#currentTimeMillis()}.
     */
    private final long expirationTimestamp;

    /**
     * Creates a new AuthenticationSession representing an in-progress
     * authentication attempt.
     *
     * @param expires
     *     The number of milliseconds that may elapse before this session must
     *     be considered invalid.
     */
    public AuthenticationSession(long expires) {
        this.expirationTimestamp = System.currentTimeMillis() + expires;
    }

    /**
     * Returns whether this authentication session is still valid (has not yet
     * expired).
     *
     * @return
     *     true if this authentication session is still valid, false if it has
     *     expired.
     */
    public boolean isValid() {
        return System.currentTimeMillis() < expirationTimestamp;
    }

}
