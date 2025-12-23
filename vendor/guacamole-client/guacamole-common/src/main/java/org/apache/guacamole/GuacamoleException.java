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

package org.apache.guacamole;

import org.apache.guacamole.protocol.GuacamoleStatus;


/**
 * A generic exception thrown when parts of the Guacamole API encounter
 * errors.
 */
public class GuacamoleException extends Exception {
    
    /**
     * Creates a new GuacamoleException with the given message and cause.
     *
     * @param message A human readable description of the exception that
     *                occurred.
     * @param cause The cause of this exception.
     */
    public GuacamoleException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * Creates a new GuacamoleException with the given message.
     *
     * @param message A human readable description of the exception that
     *                occurred.
     */
    public GuacamoleException(String message) {
        super(message);
    }

    /**
     * Creates a new GuacamoleException with the given cause.
     *
     * @param cause The cause of this exception.
     */
    public GuacamoleException(Throwable cause) {
        super(cause);
    }

    /**
     * Returns the Guacamole status associated with this exception. This status
     * can then be easily translated into an HTTP error code or Guacamole
     * protocol error code.
     * 
     * @return The corresponding Guacamole status.
     */
    public GuacamoleStatus getStatus() {
        return GuacamoleStatus.SERVER_ERROR;
    }

    /**
     * Returns the most applicable HTTP status code that can be associated
     * with this exception.
     *
     * @return
     *     An integer representing the most applicable HTTP status code
     *     associated with this exception.
     */
    public int getHttpStatusCode() {
        return getStatus().getHttpStatusCode();
    }

    /**
     * Returns the most applicable WebSocket status code that can be
     * associated with this exception.
     *
     * @return
     *     An integer representing the most applicable WebSocket status
     *     code associated with this exception.
     */
    public int getWebSocketCode() {
        return getStatus().getWebSocketCode();
    }
    
}
