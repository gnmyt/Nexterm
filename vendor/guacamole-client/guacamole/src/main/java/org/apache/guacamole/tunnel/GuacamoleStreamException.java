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

package org.apache.guacamole.tunnel;

import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.protocol.GuacamoleStatus;

/**
 * A generic exception thrown when an intercepted Guacamole stream has closed
 * with an error condition. Guacamole streams report errors using the "ack"
 * instruction, which provides a status code and human-readable message.
 */
public class GuacamoleStreamException extends GuacamoleServerException {

    /**
     * The error condition reported by the intercepted Guacamole stream.
     */
    private final GuacamoleStatus status;

    /**
     * Creates a new GuacamoleStreamException representing an error returned by
     * an intercepted stream.
     *
     * @param status
     *     The status code of the error condition reported by the intercepted
     *     Guacamole stream.
     *
     * @param message
     *     The human readable description of the error that occurred, as
     *     provided by the stream.
     */
    public GuacamoleStreamException(GuacamoleStatus status, String message) {
        super(message);
        this.status = status;
    }

    @Override
    public GuacamoleStatus getStatus() {
        return status;
    }

}
