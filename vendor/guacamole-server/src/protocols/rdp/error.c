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

#include "error.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <winpr/wtypes.h>

/**
 * Translates the error code returned by freerdp_get_last_error() for the given
 * RDP instance into a Guacamole status code and human-readable message. If no
 * error was reported, a successful error code and message will be assigned.
 *
 * @param rdp_inst
 *     The FreeRDP client instance handling the RDP connection that failed.
 *
 * @param status
 *     Pointer to the variable that should receive the guac_protocol_status
 *     value equivalent to the error returned by freerdp_get_last_error().
 *
 * @param message
 *     Pointer to the variable that should receive a static human-readable
 *     message generally describing the error returned by
 *     freerdp_get_last_error().
 */
static void guac_rdp_translate_last_error(freerdp* rdp_inst,
        guac_protocol_status* status, const char** message) {

    UINT32 last_error = freerdp_get_last_error(rdp_inst->context);
    switch (last_error) {

        /*
         * Normal disconnect (no error at all)
         */

        case FREERDP_ERROR_NONE:
        case FREERDP_ERROR_SUCCESS:
            *status = GUAC_PROTOCOL_STATUS_SUCCESS;
            *message = "Disconnected.";
            break;

        /*
         * General credentials expired (password has expired, password must be
         * reset before it can be used for the first time, etc.)
         */

#ifdef FREERDP_ERROR_CONNECT_ACCOUNT_EXPIRED
        case FREERDP_ERROR_CONNECT_ACCOUNT_EXPIRED:
#endif

#ifdef FREERDP_ERROR_CONNECT_PASSWORD_MUST_CHANGE
        case FREERDP_ERROR_CONNECT_PASSWORD_MUST_CHANGE:
#endif

        case FREERDP_ERROR_CONNECT_PASSWORD_CERTAINLY_EXPIRED:
        case FREERDP_ERROR_CONNECT_PASSWORD_EXPIRED:
        case FREERDP_ERROR_SERVER_FRESH_CREDENTIALS_REQUIRED:
            *status = GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN;
            *message = "Credentials expired.";
            break;

        /*
         * Security negotiation failed (the server is refusing the connection
         * because the security negotiation process failed)
         */

        case FREERDP_ERROR_SECURITY_NEGO_CONNECT_FAILED:
            *status = GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED;
            *message = "Security negotiation failed (wrong security type?)";
            break;

        /*
         * General access denied/revoked (regardless of any credentials
         * provided, the server is denying the requested access by this
         * account)
         */

#ifdef FREERDP_ERROR_CONNECT_ACCESS_DENIED
        case FREERDP_ERROR_CONNECT_ACCESS_DENIED:
#endif

#ifdef FREERDP_ERROR_CONNECT_ACCOUNT_DISABLED
        case FREERDP_ERROR_CONNECT_ACCOUNT_DISABLED:
#endif

#ifdef FREERDP_ERROR_CONNECT_ACCOUNT_LOCKED_OUT
        case FREERDP_ERROR_CONNECT_ACCOUNT_LOCKED_OUT:
#endif

#ifdef FREERDP_ERROR_CONNECT_ACCOUNT_RESTRICTION
        case FREERDP_ERROR_CONNECT_ACCOUNT_RESTRICTION:
#endif

#ifdef FREERDP_ERROR_CONNECT_LOGON_TYPE_NOT_GRANTED
        case FREERDP_ERROR_CONNECT_LOGON_TYPE_NOT_GRANTED:
#endif

        case FREERDP_ERROR_CONNECT_CLIENT_REVOKED:
        case FREERDP_ERROR_INSUFFICIENT_PRIVILEGES:
        case FREERDP_ERROR_SERVER_DENIED_CONNECTION:
        case FREERDP_ERROR_SERVER_INSUFFICIENT_PRIVILEGES:
            *status = GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN;
            *message = "Access denied by server (account locked/disabled?)";
            break;

        /*
         * General authentication failure (no credentials provided or wrong
         * credentials provided)
         */

#ifdef FREERDP_ERROR_CONNECT_NO_OR_MISSING_CREDENTIALS
        case FREERDP_ERROR_CONNECT_NO_OR_MISSING_CREDENTIALS:
#endif

#ifdef FREERDP_ERROR_CONNECT_LOGON_FAILURE
        case FREERDP_ERROR_CONNECT_LOGON_FAILURE:
#endif

#ifdef FREERDP_ERROR_CONNECT_WRONG_PASSWORD
        case FREERDP_ERROR_CONNECT_WRONG_PASSWORD:
#endif

        case FREERDP_ERROR_AUTHENTICATION_FAILED:
            *status = GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED;
            *message = "Authentication failure (invalid credentials?)";
            break;

        /*
         * SSL/TLS connection failed (the server's certificate is not trusted)
         */

        case FREERDP_ERROR_TLS_CONNECT_FAILED:
            *status = GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND;
            *message = "SSL/TLS connection failed (untrusted/self-signed certificate?)";
            break;

        /*
         * DNS lookup failed (hostname resolution failed or invalid IP address)
         */

        case FREERDP_ERROR_DNS_ERROR:
        case FREERDP_ERROR_DNS_NAME_NOT_FOUND:
            *status = GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND;
            *message = "DNS lookup failed (incorrect hostname?)";
            break;

        /*
         * Connection refused (the server is outright refusing to handle the
         * inbound connection, typically due to the client requesting a
         * security type that is not allowed)
         */

        case FREERDP_ERROR_CONNECT_TRANSPORT_FAILED:
            *status = GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND;
            *message = "Server refused connection (wrong security type?)";
            break;

        /*
         * Connection failed (the network connection to the server did not
         * succeed)
         */

        case FREERDP_ERROR_CONNECT_CANCELLED:
        case FREERDP_ERROR_CONNECT_FAILED:
        case FREERDP_ERROR_CONNECT_KDC_UNREACHABLE:
        case FREERDP_ERROR_MCS_CONNECT_INITIAL_ERROR:
            *status = GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND;
            *message = "Connection failed (server unreachable?)";
            break;

        /*
         * All other (unknown) errors
         */
        default:
            *status = GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR;
            *message = "Upstream error.";

    }

}

void guac_rdp_client_abort(guac_client* client, freerdp* rdp_inst) {

    /*
     * NOTE: The RDP status codes translated here are documented within
     * [MS-RDPBCGR], section 2.2.5.1.1: "Set Error Info PDU Data", in the
     * description of the "errorInfo" field.
     *
     * https://msdn.microsoft.com/en-us/library/cc240544.aspx
     */

    guac_protocol_status status;
    const char* message;

    /* Read disconnect reason code from connection */
    int error_info = freerdp_error_info(rdp_inst);

    /* Translate reason code into Guacamole protocol status */
    switch (error_info) {

        /* Possibly-normal disconnect, depending on freerdp_get_last_error() */
        case 0x0: /* ERRINFO_SUCCESS */
            guac_rdp_translate_last_error(rdp_inst, &status, &message);
            break;

        /* Forced disconnect (possibly by admin) */
        case 0x1: /* ERRINFO_RPC_INITIATED_DISCONNECT */
            status = GUAC_PROTOCOL_STATUS_SESSION_CLOSED;
            message = "Forcibly disconnected.";
            break;

        /* The user was logged off (possibly by admin) */
        case 0x2: /* ERRINFO_RPC_INITIATED_LOGOFF */
            status = GUAC_PROTOCOL_STATUS_SESSION_CLOSED;
            message = "Logged off.";
            break;

        /* The user was idle long enough that the RDP server disconnected */
        case 0x3: /* ERRINFO_IDLE_TIMEOUT */
            status = GUAC_PROTOCOL_STATUS_SESSION_TIMEOUT;
            message = "Idle session time limit exceeded.";
            break;

        /* The user's session has been active for too long */
        case 0x4: /* ERRINFO_LOGON_TIMEOUT */
            status = GUAC_PROTOCOL_STATUS_SESSION_CLOSED;
            message = "Active session time limit exceeded.";
            break;

        /* Another user logged on, disconnecting this user */
        case 0x5: /* ERRINFO_DISCONNECTED_BY_OTHER_CONNECTION */
            status = GUAC_PROTOCOL_STATUS_SESSION_CONFLICT;
            message = "Disconnected by other connection.";
            break;

        /* The RDP server is refusing to service the connection */
        case 0x6: /* ERRINFO_OUT_OF_MEMORY */
        case 0x7: /* ERRINFO_SERVER_DENIED_CONNECTION */
            status = GUAC_PROTOCOL_STATUS_UPSTREAM_UNAVAILABLE;
            message = "Server refused connection.";
            break;

        /* The user does not have permission to connect */
        case 0x9: /* ERRINFO_SERVER_INSUFFICIENT_PRIVILEGES */
            status = GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN;
            message = "Insufficient privileges.";
            break;

        /* The user's credentials have expired */
        case 0xA: /* ERRINFO_SERVER_FRESH_CREDENTIALS_REQUIRED */
            status = GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN;
            message = "Credentials expired.";
            break;

        /* The user manually disconnected using an administrative tool within
         * the session */
        case 0xB: /* ERRINFO_RPC_INITIATED_DISCONNECT_BYUSER */
            status = GUAC_PROTOCOL_STATUS_SUCCESS;
            message = "Manually disconnected.";
            break;

        /* The user manually logged off */
        case 0xC: /* ERRINFO_LOGOFF_BY_USER */
            status = GUAC_PROTOCOL_STATUS_SUCCESS;
            message = "Manually logged off.";
            break;

        /* Unimplemented/unknown disconnect reason code */
        default:
            status = GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR;
            message = "Upstream error.";

    }

    /* Send error code if an error occurred */
    if (status != GUAC_PROTOCOL_STATUS_SUCCESS) {
        guac_protocol_send_error(client->socket, message, status);
        guac_socket_flush(client->socket);
    }

    /* Log human-readable description of disconnect at info level */
    guac_client_log(client, GUAC_LOG_INFO, "RDP server closed/refused "
            "connection: %s", message);

    /* Log internal disconnect reason code at debug level */
    if (error_info)
        guac_client_log(client, GUAC_LOG_DEBUG, "Disconnect reason "
                "code: 0x%X.", error_info);

    /* Abort connection */
    guac_client_stop(client);

}

