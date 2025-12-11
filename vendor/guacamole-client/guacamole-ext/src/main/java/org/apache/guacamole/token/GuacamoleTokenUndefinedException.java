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

package org.apache.guacamole.token;

import org.apache.guacamole.GuacamoleServerException;

/**
 * An exception thrown when a token cannot be substituted because it has no
 * corresponding value. Additional information describing the undefined token
 * is provided.
 */
public class GuacamoleTokenUndefinedException extends GuacamoleServerException {

    /**
     * The name of the token that is undefined.
     */
    private final String tokenName;
    
    /**
     * Creates a new GuacamoleTokenUndefinedException with the given message,
     * cause, and associated undefined token name.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param tokenName
     *     The name of the token which has no defined value.
     */
    public GuacamoleTokenUndefinedException(String message, Throwable cause,
            String tokenName) {
        super(message, cause);
        this.tokenName = tokenName;
    }

    /**
     * Creates a new GuacamoleTokenUndefinedException with the given
     * message and associated undefined token name.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param tokenName
     *     The name of the token which has no defined value.
     */
    public GuacamoleTokenUndefinedException(String message, String tokenName) {
        super(message);
        this.tokenName = tokenName;
    }

    /**
     * Creates a new GuacamoleTokenUndefinedException with the given cause
     * and associated undefined token name.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param tokenName
     *     The name of the token which has no defined value.
     */
    public GuacamoleTokenUndefinedException(Throwable cause, String tokenName) {
        super(cause);
        this.tokenName = tokenName;
    }

    /**
     * Returns the name of the token which has no defined value, causing this
     * exception to be thrown.
     *
     * @return
     *     The name of the token which has no defined value.
     */
    public String getTokenName() {
        return tokenName;
    }

}
