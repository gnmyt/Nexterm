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

#ifndef _GUAC_PROTOCOL_TYPES_H
#define _GUAC_PROTOCOL_TYPES_H

/**
 * Type definitions related to the Guacamole protocol.
 *
 * @file protocol-types.h
 */

/**
 * Set of all possible status codes returned by protocol operations. These
 * codes relate to Guacamole server/client communication, and not to internal
 * communication of errors within libguac and linked software.
 *
 * In general:
 *
 *     0x0000 - 0x00FF: Successful operations.
 *     0x0100 - 0x01FF: Operations that failed due to implementation status.
 *     0x0200 - 0x02FF: Operations that failed due to remote state/environment.
 *     0x0300 - 0x03FF: Operations that failed due to user/client action.
 *
 * There is a general correspondence of these status codes with HTTP response
 * codes.
 */
typedef enum guac_protocol_status {

    /**
     * The operation succeeded.
     */
    GUAC_PROTOCOL_STATUS_SUCCESS = 0x0000,

    /**
     * The requested operation is unsupported.
     */
    GUAC_PROTOCOL_STATUS_UNSUPPORTED = 0x0100,

    /**
     * The operation could not be performed due to an internal failure.
     */
    GUAC_PROTOCOL_STATUS_SERVER_ERROR = 0x0200,

    /**
     * The operation could not be performed due as the server is busy.
     */
    GUAC_PROTOCOL_STATUS_SERVER_BUSY = 0x0201,

    /**
     * The operation could not be performed because the upstream server
     * is not responding.
     */
    GUAC_PROTOCOL_STATUS_UPSTREAM_TIMEOUT = 0x0202,

    /**
     * The operation was unsuccessful due to an error or otherwise
     * unexpected condition of the upstream server.
     */
    GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR = 0x0203,

    /**
     * The operation could not be performed as the requested resource
     * does not exist.
     */
    GUAC_PROTOCOL_STATUS_RESOURCE_NOT_FOUND = 0x0204,

    /**
     * The operation could not be performed as the requested resource is
     * already in use.
     */
    GUAC_PROTOCOL_STATUS_RESOURCE_CONFLICT = 0x0205,

    /**
     * The operation could not be performed as the requested resource is now
     * closed.
     */
    GUAC_PROTOCOL_STATUS_RESOURCE_CLOSED = 0x0206,

    /**
     * The operation could not be performed because the upstream server does
     * not appear to exist.
     */
    GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND = 0x0207,

    /**
     * The operation could not be performed because the upstream server is not
     * available to service the request.
     */
    GUAC_PROTOCOL_STATUS_UPSTREAM_UNAVAILABLE = 0x0208,

    /**
     * The session within the upstream server has ended because it conflicted
     * with another session.
     */
    GUAC_PROTOCOL_STATUS_SESSION_CONFLICT = 0x0209,

    /**
     * The session within the upstream server has ended because it appeared to
     * be inactive.
     */
    GUAC_PROTOCOL_STATUS_SESSION_TIMEOUT = 0x020A,

    /**
     * The session within the upstream server has been forcibly terminated.
     */
    GUAC_PROTOCOL_STATUS_SESSION_CLOSED = 0x020B,

    /**
     * The operation could not be performed because bad parameters were
     * given.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_BAD_REQUEST = 0x300,

    /**
     * Permission was denied to perform the operation, as the user is not
     * yet authorized (not yet logged in, for example).
     */
    GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED = 0x0301,

    /**
     * Permission was denied to perform the operation, and this permission
     * will not be granted even if the user is authorized.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN = 0x0303,

    /**
     * The client took too long to respond.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_TIMEOUT = 0x308,

    /**
     * The client sent too much data.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_OVERRUN = 0x30D,

    /**
     * The client sent data of an unsupported or unexpected type.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_BAD_TYPE = 0x30F,

    /**
     * The operation failed because the current client is already
     * using too many resources.
     */
    GUAC_PROTOCOL_STATUS_CLIENT_TOO_MANY = 0x31D

} guac_protocol_status;

/**
 * Composite modes used by Guacamole draw instructions. Each
 * composite mode maps to a unique channel mask integer.
 */
typedef enum guac_composite_mode {

    /*
     * A: Source where destination transparent = S n D'
     * B: Source where destination opaque      = S n D
     * C: Destination where source transparent = D n S'
     * D: Destination where source opaque      = D n S
     *
     * 0 = Active, 1 = Inactive
     */
                           /* ABCD */
    GUAC_COMP_ROUT  = 0x2, /* 0010 - Clears destination where source opaque  */
    GUAC_COMP_ATOP  = 0x6, /* 0110 - Fill where destination opaque only      */
    GUAC_COMP_XOR   = 0xA, /* 1010 - XOR                                     */
    GUAC_COMP_ROVER = 0xB, /* 1011 - Fill where destination transparent only */
    GUAC_COMP_OVER  = 0xE, /* 1110 - Draw normally                           */
    GUAC_COMP_PLUS  = 0xF, /* 1111 - Add                                     */

    /* Unimplemented in client: */
    /* NOT IMPLEMENTED:       0000 - Clear          */
    /* NOT IMPLEMENTED:       0011 - No operation   */
    /* NOT IMPLEMENTED:       0101 - Additive IN    */
    /* NOT IMPLEMENTED:       0111 - Additive ATOP  */
    /* NOT IMPLEMENTED:       1101 - Additive RATOP */

    /* Buggy in webkit browsers, as they keep channel C on in all cases: */
    GUAC_COMP_RIN   = 0x1, /* 0001 */
    GUAC_COMP_IN    = 0x4, /* 0100 */
    GUAC_COMP_OUT   = 0x8, /* 1000 */
    GUAC_COMP_RATOP = 0x9, /* 1001 */
    GUAC_COMP_SRC   = 0xC  /* 1100 */

    /* Bitwise composite operations (binary) */

    /*
     * A: S' & D'
     * B: S' & D
     * C: S  & D'
     * D: S  & D
     *
     * 0 = Active, 1 = Inactive
     */

} guac_composite_mode;

/**
 * Default transfer functions. There is no current facility in the
 * Guacamole protocol to define custom transfer functions.
 */
typedef enum guac_transfer_function {

    /* Constant functions */               /* ABCD */
    GUAC_TRANSFER_BINARY_BLACK      = 0x0, /* 0000 */
    GUAC_TRANSFER_BINARY_WHITE      = 0xF, /* 1111 */

    /* Copy functions */
    GUAC_TRANSFER_BINARY_SRC        = 0x3, /* 0011 */
    GUAC_TRANSFER_BINARY_DEST       = 0x5, /* 0101 */
    GUAC_TRANSFER_BINARY_NSRC       = 0xC, /* 1100 */
    GUAC_TRANSFER_BINARY_NDEST      = 0xA, /* 1010 */

    /* AND / NAND */
    GUAC_TRANSFER_BINARY_AND        = 0x1, /* 0001 */
    GUAC_TRANSFER_BINARY_NAND       = 0xE, /* 1110 */

    /* OR / NOR */
    GUAC_TRANSFER_BINARY_OR         = 0x7, /* 0111 */
    GUAC_TRANSFER_BINARY_NOR        = 0x8, /* 1000 */

    /* XOR / XNOR */
    GUAC_TRANSFER_BINARY_XOR        = 0x6, /* 0110 */
    GUAC_TRANSFER_BINARY_XNOR       = 0x9, /* 1001 */

    /* AND / NAND with inverted source */
    GUAC_TRANSFER_BINARY_NSRC_AND   = 0x4, /* 0100 */
    GUAC_TRANSFER_BINARY_NSRC_NAND  = 0xB, /* 1011 */

    /* OR / NOR with inverted source */
    GUAC_TRANSFER_BINARY_NSRC_OR    = 0xD, /* 1101 */
    GUAC_TRANSFER_BINARY_NSRC_NOR   = 0x2, /* 0010 */

    /* AND / NAND with inverted destination */
    GUAC_TRANSFER_BINARY_NDEST_AND  = 0x2, /* 0010 */
    GUAC_TRANSFER_BINARY_NDEST_NAND = 0xD, /* 1101 */

    /* OR / NOR with inverted destination */
    GUAC_TRANSFER_BINARY_NDEST_OR   = 0xB, /* 1011 */
    GUAC_TRANSFER_BINARY_NDEST_NOR  = 0x4  /* 0100 */

} guac_transfer_function;

/**
 * Supported line cap styles
 */
typedef enum guac_line_cap_style {
    GUAC_LINE_CAP_BUTT   = 0x0,
    GUAC_LINE_CAP_ROUND  = 0x1,
    GUAC_LINE_CAP_SQUARE = 0x2
} guac_line_cap_style;

/**
 * Supported line join styles
 */
typedef enum guac_line_join_style {
    GUAC_LINE_JOIN_BEVEL = 0x0,
    GUAC_LINE_JOIN_MITER = 0x1,
    GUAC_LINE_JOIN_ROUND = 0x2
} guac_line_join_style;

/**
 * The set of protocol versions known to guacd to handle negotiation or feature
 * support between differing versions of Guacamole clients and guacd.
 */
typedef enum guac_protocol_version {
    
    /**
     * An unknown version of the Guacamole protocol.
     */
    GUAC_PROTOCOL_VERSION_UNKNOWN = 0x000000,
    
    /**
     * Original protocol version 1.0.0, which lacks support for negotiating
     * parameters and protocol version, and requires that parameters in the
     * client/server handshake be delivered in order.
     */
    GUAC_PROTOCOL_VERSION_1_0_0 = 0x010000,
            
    /**
     * Protocol version 1.1.0, which includes support for parameter and version
     * negotiation and for sending timezone information from the client
     * to the server.
     */
    GUAC_PROTOCOL_VERSION_1_1_0 = 0x010100,
            
    /**
     * Protocol version 1.3.0, which supports the "required" instruction,
     * allowing connections in guacd to request information from the client and
     * await a response.
     */
    GUAC_PROTOCOL_VERSION_1_3_0 = 0x010300,

    /**
     * Protocol version 1.5.0, which supports the "msg" instruction, allowing
     * messages to be sent to the client, and adds support for the "name"
     * handshake instruction.
     */
    GUAC_PROTOCOL_VERSION_1_5_0 = 0x010500

} guac_protocol_version;

/**
 * A type that represents codes for human-readable messages sent by the "msg"
 * instruction to the Client, that will be displayed in the client's browser.
 * The codes will be interpreted by the client into translatable messages, and
 * make take arguments, as noted below.
 */
typedef enum guac_message_type {

    /**
     * A message that notifies the owner of a connection that another user has
     * joined their connection. There should be a single argument provided, the
     * name of the user who has joined.
     */
    GUAC_MESSAGE_USER_JOINED = 0x0001,

    /**
     * A message that notifies the owner of a connection that another user has
     * left their connection. There should be a single argument provided, the
     * name of the user who has left.
     */
    GUAC_MESSAGE_USER_LEFT = 0x0002

} guac_message_type;

#endif

