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

package org.apache.guacamole.protocol;

import org.apache.guacamole.GuacamoleClientBadTypeException;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleClientOverrunException;
import org.apache.guacamole.GuacamoleClientTimeoutException;
import org.apache.guacamole.GuacamoleClientTooManyException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceClosedException;
import org.apache.guacamole.GuacamoleResourceConflictException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleServerBusyException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.GuacamoleSessionClosedException;
import org.apache.guacamole.GuacamoleSessionConflictException;
import org.apache.guacamole.GuacamoleSessionTimeoutException;
import org.apache.guacamole.GuacamoleUnauthorizedException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.GuacamoleUpstreamException;
import org.apache.guacamole.GuacamoleUpstreamNotFoundException;
import org.apache.guacamole.GuacamoleUpstreamTimeoutException;
import org.apache.guacamole.GuacamoleUpstreamUnavailableException;

/**
 * All possible statuses returned by various Guacamole instructions, each having
 * a corresponding code.
 */
public enum GuacamoleStatus {

    /**
     * The operation succeeded.
     */
    SUCCESS(200, 1000, 0x0000) {

        @Override
        public GuacamoleException toException(String message) {
            throw new IllegalStateException("The Guacamole protocol SUCCESS "
                    + "status code cannot be converted into a "
                    + "GuacamoleException.", new GuacamoleServerException(message));
        }

    },

    /**
     * The requested operation is unsupported.
     */
    UNSUPPORTED(501, 1011, 0x0100) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUnsupportedException(message);
        }

    },

    /**
     * The operation could not be performed due to an internal failure.
     */
    SERVER_ERROR(500, 1011, 0x0200) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleServerException(message);
        }

    },

    /**
     * The operation could not be performed as the server is busy.
     */
    SERVER_BUSY(503, 1008, 0x0201) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleServerBusyException(message);
        }

    },

    /**
     * The operation could not be performed because the upstream server is not
     * responding.
     */
    UPSTREAM_TIMEOUT(504, 1011, 0x0202) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUpstreamTimeoutException(message);
        }

    },

    /**
     * The operation was unsuccessful due to an error or otherwise unexpected
     * condition of the upstream server.
     */
    UPSTREAM_ERROR(502, 1011, 0x0203) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUpstreamException(message);
        }

    },

    /**
     * The operation could not be performed as the requested resource does not
     * exist.
     */
    RESOURCE_NOT_FOUND(404, 1002, 0x0204) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleResourceNotFoundException(message);
        }

    },

    /**
     * The operation could not be performed as the requested resource is already
     * in use.
     */
    RESOURCE_CONFLICT(409, 1008, 0x0205) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleResourceConflictException(message);
        }

    },

    /**
     * The operation could not be performed as the requested resource is now
     * closed.
     */
    RESOURCE_CLOSED(404, 1002, 0x0206) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleResourceClosedException(message);
        }

    },

    /**
     * The operation could not be performed because the upstream server does
     * not appear to exist.
     */
    UPSTREAM_NOT_FOUND(502, 1011, 0x0207) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUpstreamNotFoundException(message);
        }

    },

    /**
     * The operation could not be performed because the upstream server is not
     * available to service the request.
     */
    UPSTREAM_UNAVAILABLE(502, 1011, 0x0208) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUpstreamUnavailableException(message);
        }

    },

    /**
     * The session within the upstream server has ended because it conflicted
     * with another session.
     */
    SESSION_CONFLICT(409, 1008, 0x0209) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleSessionConflictException(message);
        }

    },

    /**
     * The session within the upstream server has ended because it appeared to
     * be inactive.
     */
    SESSION_TIMEOUT(408, 1002, 0x020A) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleSessionTimeoutException(message);
        }

    },

    /**
     * The session within the upstream server has been forcibly terminated.
     */
    SESSION_CLOSED(404, 1002, 0x020B) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleSessionClosedException(message);
        }

    },

    /**
     * The operation could not be performed because bad parameters were given.
     */
    CLIENT_BAD_REQUEST(400, 1002, 0x0300) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleClientException(message);
        }

    },

    /**
     * Permission was denied to perform the operation, as the user is not yet
     * authorized (not yet logged in, for example). As HTTP 401 has implications
     * for HTTP-specific authorization schemes, this status continues to map to
     * HTTP 403 ("Forbidden"). To do otherwise would risk unintended effects.
     */
    CLIENT_UNAUTHORIZED(403, 1008, 0x0301) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleUnauthorizedException(message);
        }

    },

    /**
     * Permission was denied to perform the operation, and this operation will
     * not be granted even if the user is authorized.
     */
    CLIENT_FORBIDDEN(403, 1008, 0x0303) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleSecurityException(message);
        }

    },

    /**
     * The client took too long to respond.
     */
    CLIENT_TIMEOUT(408, 1002, 0x0308) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleClientTimeoutException(message);
        }

    },

    /**
     * The client sent too much data.
     */
    CLIENT_OVERRUN(413, 1009, 0x030D) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleClientOverrunException(message);
        }

    },

    /**
     * The client sent data of an unsupported or unexpected type.
     */
    CLIENT_BAD_TYPE(415, 1003, 0x030F) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleClientBadTypeException(message);
        }

    },

    /**
     * The operation failed because the current client is already using too
     * many resources.
     */
    CLIENT_TOO_MANY(429, 1008, 0x031D) {

        @Override
        public GuacamoleException toException(String message) {
            return new GuacamoleClientTooManyException(message);
        }

    };

    /**
     * The most applicable HTTP error code.
     */
    private final int http_code;

    /**
     * The most applicable WebSocket error code.
     */
    private final int websocket_code;
    
    /**
     * The Guacamole protocol status code.
     */
    private final int guac_code;

    /**
     * Initializes a GuacamoleStatusCode with the given HTTP and Guacamole
     * status/error code values.
     * 
     * @param http_code The most applicable HTTP error code.
     * @param websocket_code The most applicable WebSocket error code.
     * @param guac_code The Guacamole protocol status code.
     */
    private GuacamoleStatus(int http_code, int websocket_code, int guac_code) {
        this.http_code = http_code;
        this.websocket_code = websocket_code;
        this.guac_code = guac_code;
    }

    /**
     * Returns the most applicable HTTP error code.
     * 
     * @return The most applicable HTTP error code.
     */
    public int getHttpStatusCode() {
        return http_code;
    }

    /**
     * Returns the most applicable HTTP error code.
     * 
     * @return The most applicable HTTP error code.
     */
    public int getWebSocketCode() {
        return websocket_code;
    }

    /**
     * Returns the corresponding Guacamole protocol status code.
     * 
     * @return The corresponding Guacamole protocol status code.
     */
    public int getGuacamoleStatusCode() {
        return guac_code;
    }

    /**
     * Returns the GuacamoleStatus corresponding to the given Guacamole
     * protocol status code. If no such GuacamoleStatus is defined, null is
     * returned.
     *
     * @param code
     *     The Guacamole protocol status code to translate into a
     *     GuacamoleStatus.
     *
     * @return
     *     The GuacamoleStatus corresponding to the given Guacamole protocol
     *     status code, or null if no such GuacamoleStatus is defined.
     */
    public static GuacamoleStatus fromGuacamoleStatusCode(int code) {

        // Search for a GuacamoleStatus having the given status code
        for (GuacamoleStatus status : values()) {
            if (status.getGuacamoleStatusCode() == code)
                return status;
        }

        // No such status found
        return null;

    }

    /**
     * Returns an instance of the {@link GuacamoleException} subclass
     * corresponding to this Guacamole protocol status code. All status codes
     * have a corresponding GuacamoleException except for {@link SUCCESS}. The
     * returned GuacamoleException will have the provided human-readable
     * message.
     *
     * @param message
     *     A human readable description of the error that occurred.
     *
     * @return
     *     An instance of the {@link GuacamoleException} subclass that
     *     corresponds to this status code and has the provided human-readable
     *     message.
     *
     * @throws IllegalStateException
     *    If invoked on {@link SUCCESS}, which has no corresponding
     *    GuacamoleException.
     */
    public abstract GuacamoleException toException(String message);

}
