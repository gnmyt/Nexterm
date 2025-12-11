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

#ifndef _GUAC_ERROR_TYPES_H
#define _GUAC_ERROR_TYPES_H

/**
 * Type definitions related to return values and errors.
 *
 * @file error-types.h
 */

/**
 * Return codes shared by all Guacamole functions which can fail.
 */
typedef enum guac_status {

    /**
     * No errors occurred and the operation was successful.
     */
    GUAC_STATUS_SUCCESS = 0,

    /**
     * Insufficient memory to complete the operation.
     */
    GUAC_STATUS_NO_MEMORY,

    /**
     * The resource associated with the operation can no longer be used as it
     * has reached the end of its normal lifecycle.
     */
    GUAC_STATUS_CLOSED,

    /**
     * Time ran out before the operation could complete.
     */
    GUAC_STATUS_TIMEOUT,

    /**
     * An error occurred, and further information about the error is already
     * stored in errno.
     */
    GUAC_STATUS_SEE_ERRNO,

    /**
     * An I/O error prevented the operation from succeeding.
     */
    GUAC_STATUS_IO_ERROR,

    /**
     * The operation could not be performed because an invalid argument was
     * given.
     */
    GUAC_STATUS_INVALID_ARGUMENT,

    /**
     * The operation failed due to a bug in the software or a serious system
     * problem.
     */
    GUAC_STATUS_INTERNAL_ERROR,

    /**
     * Insufficient space remaining to complete the operation.
     */
    GUAC_STATUS_NO_SPACE,

    /**
     * The operation failed because the input provided is too large.
     */
    GUAC_STATUS_INPUT_TOO_LARGE,

    /**
     * The operation failed because the result could not be stored in the
     * space provided.
     */
    GUAC_STATUS_RESULT_TOO_LARGE,

    /**
     * Permission was denied to perform the operation.
     */
    GUAC_STATUS_PERMISSION_DENIED,

    /**
     * The operation could not be performed because associated resources are
     * busy.
     */
    GUAC_STATUS_BUSY,

    /**
     * The operation could not be performed because, while the associated
     * resources do exist, they are not currently available for use.
     */
    GUAC_STATUS_NOT_AVAILABLE,

    /**
     * The requested operation is not supported.
     */
    GUAC_STATUS_NOT_SUPPORTED,

    /**
     * Support for the requested operation is not yet implemented.
     *
     * @deprecated This constant contains a typo in its name and will be
     * removed in a future release. Use GUAC_STATUS_NOT_IMPLEMENTED instead.
     */
    GUAC_STATUS_NOT_INPLEMENTED = 15,

    /**
     * Support for the requested operation is not yet implemented.
     */
    GUAC_STATUS_NOT_IMPLEMENTED = 15,

    /**
     * The operation is temporarily unable to be performed, but may succeed if
     * reattempted.
     */
    GUAC_STATUS_TRY_AGAIN,

    /**
     * A violation of the Guacamole protocol occurred.
     */
    GUAC_STATUS_PROTOCOL_ERROR,

    /**
     * The operation could not be performed because the requested resources do
     * not exist.
     */
    GUAC_STATUS_NOT_FOUND,

    /**
     * The operation was canceled prior to completion.
     */
    GUAC_STATUS_CANCELED,

    /**
     * The operation could not be performed because input values are outside
     * the allowed range.
     */
    GUAC_STATUS_OUT_OF_RANGE,

    /**
     * The operation could not be performed because access to an underlying
     * resource is explicitly not allowed, though not necessarily due to
     * permissions.
     */
    GUAC_STATUS_REFUSED,

    /**
     * The operation failed because too many resources are already in use.
     */
    GUAC_STATUS_TOO_MANY,

    /**
     * The operation was not performed because it would otherwise block.
     */
    GUAC_STATUS_WOULD_BLOCK

} guac_status;

#endif

