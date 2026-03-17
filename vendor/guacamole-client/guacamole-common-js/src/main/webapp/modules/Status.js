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

var Guacamole = Guacamole || {};

/**
 * A Guacamole status. Each Guacamole status consists of a status code, defined
 * by the protocol, and an optional human-readable message, usually only
 * included for debugging convenience.
 *
 * @constructor
 * @param {!number} code
 *     The Guacamole status code, as defined by Guacamole.Status.Code.
 *
 * @param {string} [message]
 *     An optional human-readable message.
 */
Guacamole.Status = function(code, message) {

    /**
     * Reference to this Guacamole.Status.
     *
     * @private
     * @type {!Guacamole.Status}
     */
    var guac_status = this;

    /**
     * The Guacamole status code.
     *
     * @see Guacamole.Status.Code
     * @type {!number}
     */
    this.code = code;

    /**
     * An arbitrary human-readable message associated with this status, if any.
     * The human-readable message is not required, and is generally provided
     * for debugging purposes only. For user feedback, it is better to translate
     * the Guacamole status code into a message.
     * 
     * @type {string}
     */
    this.message = message;

    /**
     * Returns whether this status represents an error.
     *
     * @returns {!boolean}
     *     true if this status represents an error, false otherwise.
     */
    this.isError = function() {
        return guac_status.code < 0 || guac_status.code > 0x00FF;
    };

};

/**
 * Enumeration of all Guacamole status codes.
 */
Guacamole.Status.Code = {

    /**
     * The operation succeeded.
     *
     * @type {!number}
     */
    "SUCCESS": 0x0000,

    /**
     * The requested operation is unsupported.
     *
     * @type {!number}
     */
    "UNSUPPORTED": 0x0100,

    /**
     * The operation could not be performed due to an internal failure.
     *
     * @type {!number}
     */
    "SERVER_ERROR": 0x0200,

    /**
     * The operation could not be performed as the server is busy.
     *
     * @type {!number}
     */
    "SERVER_BUSY": 0x0201,

    /**
     * The operation could not be performed because the upstream server is not
     * responding.
     *
     * @type {!number}
     */
    "UPSTREAM_TIMEOUT": 0x0202,

    /**
     * The operation was unsuccessful due to an error or otherwise unexpected
     * condition of the upstream server.
     *
     * @type {!number}
     */
    "UPSTREAM_ERROR": 0x0203,

    /**
     * The operation could not be performed as the requested resource does not
     * exist.
     *
     * @type {!number}
     */
    "RESOURCE_NOT_FOUND": 0x0204,

    /**
     * The operation could not be performed as the requested resource is
     * already in use.
     *
     * @type {!number}
     */
    "RESOURCE_CONFLICT": 0x0205,

    /**
     * The operation could not be performed as the requested resource is now
     * closed.
     *
     * @type {!number}
     */
    "RESOURCE_CLOSED": 0x0206,

    /**
     * The operation could not be performed because the upstream server does
     * not appear to exist.
     *
     * @type {!number}
     */
    "UPSTREAM_NOT_FOUND": 0x0207,

    /**
     * The operation could not be performed because the upstream server is not
     * available to service the request.
     *
     * @type {!number}
     */
    "UPSTREAM_UNAVAILABLE": 0x0208,

    /**
     * The session within the upstream server has ended because it conflicted
     * with another session.
     *
     * @type {!number}
     */
    "SESSION_CONFLICT": 0x0209,

    /**
     * The session within the upstream server has ended because it appeared to
     * be inactive.
     *
     * @type {!number}
     */
    "SESSION_TIMEOUT": 0x020A,

    /**
     * The session within the upstream server has been forcibly terminated.
     *
     * @type {!number}
     */
    "SESSION_CLOSED": 0x020B,

    /**
     * The operation could not be performed because bad parameters were given.
     *
     * @type {!number}
     */
    "CLIENT_BAD_REQUEST": 0x0300,

    /**
     * Permission was denied to perform the operation, as the user is not yet
     * authorized (not yet logged in, for example).
     *
     * @type {!number}
     */
    "CLIENT_UNAUTHORIZED": 0x0301,

    /**
     * Permission was denied to perform the operation, and this permission will
     * not be granted even if the user is authorized.
     *
     * @type {!number}
     */
    "CLIENT_FORBIDDEN": 0x0303,

    /**
     * The client took too long to respond.
     *
     * @type {!number}
     */
    "CLIENT_TIMEOUT": 0x0308,

    /**
     * The client sent too much data.
     *
     * @type {!number}
     */
    "CLIENT_OVERRUN": 0x030D,

    /**
     * The client sent data of an unsupported or unexpected type.
     *
     * @type {!number}
     */
    "CLIENT_BAD_TYPE": 0x030F,

    /**
     * The operation failed because the current client is already using too
     * many resources.
     *
     * @type {!number}
     */
    "CLIENT_TOO_MANY": 0x031D

};

/**
 * Returns the Guacamole protocol status code which most closely
 * represents the given HTTP status code.
 *
 * @param {!number} status
 *     The HTTP status code to translate into a Guacamole protocol status
 *     code.
 *
 * @returns {!number}
 *     The Guacamole protocol status code which most closely represents the
 *     given HTTP status code.
 */
Guacamole.Status.Code.fromHTTPCode = function fromHTTPCode(status) {

    // Translate status codes with known equivalents
    switch (status) {

        // HTTP 400 - Bad request
        case 400:
            return Guacamole.Status.Code.CLIENT_BAD_REQUEST;

        // HTTP 403 - Forbidden
        case 403:
            return Guacamole.Status.Code.CLIENT_FORBIDDEN;

        // HTTP 404 - Resource not found
        case 404:
            return Guacamole.Status.Code.RESOURCE_NOT_FOUND;

        // HTTP 429 - Too many requests
        case 429:
            return Guacamole.Status.Code.CLIENT_TOO_MANY;

        // HTTP 503 - Server unavailable
        case 503:
            return Guacamole.Status.Code.SERVER_BUSY;

    }

    // Default all other codes to generic internal error
    return Guacamole.Status.Code.SERVER_ERROR;

};

/**
 * Returns the Guacamole protocol status code which most closely
 * represents the given WebSocket status code.
 *
 * @param {!number} code
 *     The WebSocket status code to translate into a Guacamole protocol
 *     status code.
 *
 * @returns {!number}
 *     The Guacamole protocol status code which most closely represents the
 *     given WebSocket status code.
 */
Guacamole.Status.Code.fromWebSocketCode = function fromWebSocketCode(code) {

    // Translate status codes with known equivalents
    switch (code) {

        // Successful disconnect (no error)
        case 1000: // Normal Closure
            return Guacamole.Status.Code.SUCCESS;

        // Codes which indicate the server is not reachable
        case 1006: // Abnormal Closure (also signalled by JavaScript when the connection cannot be opened in the first place)
        case 1015: // TLS Handshake
            return Guacamole.Status.Code.UPSTREAM_NOT_FOUND;

        // Codes which indicate the server is reachable but busy/unavailable
        case 1001: // Going Away
        case 1012: // Service Restart
        case 1013: // Try Again Later
        case 1014: // Bad Gateway
            return Guacamole.Status.Code.UPSTREAM_UNAVAILABLE;

    }

    // Default all other codes to generic internal error
    return Guacamole.Status.Code.SERVER_ERROR;

};
