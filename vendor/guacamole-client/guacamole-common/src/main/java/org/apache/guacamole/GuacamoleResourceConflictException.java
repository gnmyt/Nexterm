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
 * An exception which is thrown when a resource has been requested, but that
 * resource is locked or currently in use, and cannot be accessed by the
 * current user.
 */
public class GuacamoleResourceConflictException extends GuacamoleClientException {

    /**
     * Creates a new GuacamoleResourceConflictException with the given message and cause.
     *
     * @param message A human readable description of the exception that
     *                occurred.
     * @param cause The cause of this exception.
     */
    public GuacamoleResourceConflictException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * Creates a new GuacamoleResourceConflictException with the given message.
     *
     * @param message A human readable description of the exception that
     *                occurred.
     */
    public GuacamoleResourceConflictException(String message) {
        super(message);
    }

    /**
     * Creates a new GuacamoleResourceConflictException with the given cause.
     *
     * @param cause The cause of this exception.
     */
    public GuacamoleResourceConflictException(Throwable cause) {
        super(cause);
    }

    @Override
    public GuacamoleStatus getStatus() {
        return GuacamoleStatus.RESOURCE_CONFLICT;
    }

}
