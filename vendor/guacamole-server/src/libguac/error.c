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

#include "config.h"

#include "guacamole/mem.h"
#include "guacamole/error.h"

#include <errno.h>
#include <stdlib.h>
#include <string.h>

#ifdef HAVE_LIBPTHREAD
#include <pthread.h>
#endif

/*
 * Error strings
 */

const char* __GUAC_STATUS_SUCCESS_STR           = "Success";
const char* __GUAC_STATUS_NO_MEMORY_STR         = "Insufficient memory";
const char* __GUAC_STATUS_CLOSED_STR            = "Closed";
const char* __GUAC_STATUS_TIMEOUT_STR           = "Timed out";
const char* __GUAC_STATUS_IO_ERROR_STR          = "Input/output error";
const char* __GUAC_STATUS_INVALID_ARGUMENT_STR  = "Invalid argument";
const char* __GUAC_STATUS_INTERNAL_ERROR_STR    = "Internal error";
const char* __GUAC_STATUS_UNKNOWN_STATUS_STR    = "UNKNOWN STATUS CODE";
const char* __GUAC_STATUS_NO_SPACE_STR          = "Insufficient space";
const char* __GUAC_STATUS_INPUT_TOO_LARGE_STR   = "Input too large";
const char* __GUAC_STATUS_RESULT_TOO_LARGE_STR  = "Result too large";
const char* __GUAC_STATUS_PERMISSION_DENIED_STR = "Permission denied";
const char* __GUAC_STATUS_BUSY_STR              = "Resource busy";
const char* __GUAC_STATUS_NOT_AVAILABLE_STR     = "Resource not available";
const char* __GUAC_STATUS_NOT_SUPPORTED_STR     = "Not supported";
const char* __GUAC_STATUS_NOT_IMPLEMENTED_STR   = "Not implemented";
const char* __GUAC_STATUS_TRY_AGAIN_STR         = "Temporary failure";
const char* __GUAC_STATUS_PROTOCOL_ERROR_STR    = "Protocol violation";
const char* __GUAC_STATUS_NOT_FOUND_STR         = "Not found";
const char* __GUAC_STATUS_CANCELED_STR          = "Canceled";
const char* __GUAC_STATUS_OUT_OF_RANGE_STR      = "Value out of range";
const char* __GUAC_STATUS_REFUSED_STR           = "Operation refused";
const char* __GUAC_STATUS_TOO_MANY_STR          = "Insufficient resources";
const char* __GUAC_STATUS_WOULD_BLOCK_STR       = "Operation would block";

const char* guac_status_string(guac_status status) {

    switch (status) {

        /* No error */
		case GUAC_STATUS_SUCCESS:
            return __GUAC_STATUS_SUCCESS_STR;

        /* Out of memory */
		case GUAC_STATUS_NO_MEMORY:
            return __GUAC_STATUS_NO_MEMORY_STR;

        /* End of stream */
		case GUAC_STATUS_CLOSED:
            return __GUAC_STATUS_CLOSED_STR;

        /* Timeout */
		case GUAC_STATUS_TIMEOUT:
            return __GUAC_STATUS_TIMEOUT_STR;

        /* Further information in errno */
		case GUAC_STATUS_SEE_ERRNO:
            return strerror(errno);

        /* Input/output error */
		case GUAC_STATUS_IO_ERROR:
            return __GUAC_STATUS_IO_ERROR_STR;

        /* Invalid argument */
		case GUAC_STATUS_INVALID_ARGUMENT:
            return __GUAC_STATUS_INVALID_ARGUMENT_STR;

        /* Internal error */
		case GUAC_STATUS_INTERNAL_ERROR:
            return __GUAC_STATUS_INTERNAL_ERROR_STR;

        /* Out of space */
		case GUAC_STATUS_NO_SPACE:
            return __GUAC_STATUS_NO_SPACE_STR;

        /* Input too large */
        case GUAC_STATUS_INPUT_TOO_LARGE:
            return __GUAC_STATUS_INPUT_TOO_LARGE_STR;

        /* Result too large */
        case GUAC_STATUS_RESULT_TOO_LARGE:
            return __GUAC_STATUS_RESULT_TOO_LARGE_STR;

        /* Permission denied */
        case GUAC_STATUS_PERMISSION_DENIED:
            return __GUAC_STATUS_PERMISSION_DENIED_STR;

        /* Resource is busy */
        case GUAC_STATUS_BUSY:
            return __GUAC_STATUS_BUSY_STR;

        /* Resource not available */
        case GUAC_STATUS_NOT_AVAILABLE:
            return __GUAC_STATUS_NOT_AVAILABLE_STR;

        /* Not supported */
        case GUAC_STATUS_NOT_SUPPORTED:
            return __GUAC_STATUS_NOT_SUPPORTED_STR;

        /* Not implemented */
        case GUAC_STATUS_NOT_IMPLEMENTED:
            return __GUAC_STATUS_NOT_IMPLEMENTED_STR;

        /* Temporary failure */
        case GUAC_STATUS_TRY_AGAIN:
            return __GUAC_STATUS_TRY_AGAIN_STR;

        /* Guacamole protocol error */
        case GUAC_STATUS_PROTOCOL_ERROR:
            return __GUAC_STATUS_PROTOCOL_ERROR_STR;

        /* Resource not found */
        case GUAC_STATUS_NOT_FOUND:
            return __GUAC_STATUS_NOT_FOUND_STR;

        /* Operation canceled */
        case GUAC_STATUS_CANCELED:
            return __GUAC_STATUS_CANCELED_STR;

        /* Value out of range */
        case GUAC_STATUS_OUT_OF_RANGE:
            return __GUAC_STATUS_OUT_OF_RANGE_STR;

        /* Operation refused */
        case GUAC_STATUS_REFUSED:
            return __GUAC_STATUS_REFUSED_STR;

        /* Too many resource in use */
        case GUAC_STATUS_TOO_MANY:
            return __GUAC_STATUS_TOO_MANY_STR;

        /* Operation would block */
        case GUAC_STATUS_WOULD_BLOCK:
            return __GUAC_STATUS_WOULD_BLOCK_STR;

        /* Unknown status code */
        default:
            return __GUAC_STATUS_UNKNOWN_STATUS_STR;

    }

}

#ifdef HAVE_LIBPTHREAD

/* PThread implementation of __guac_error */

static pthread_key_t  __guac_error_key;
static pthread_once_t __guac_error_key_init = PTHREAD_ONCE_INIT;

static pthread_key_t  __guac_error_message_key;
static pthread_once_t __guac_error_message_key_init = PTHREAD_ONCE_INIT;

static void __guac_mem_free_pointer(void* pointer) {

    /* Free memory allocated to status variable */
    guac_mem_free(pointer);

}

static void __guac_alloc_error_key() {

    /* Create key, destroy any allocated variable on thread exit */
    pthread_key_create(&__guac_error_key, __guac_mem_free_pointer);

}

static void __guac_alloc_error_message_key() {

    /* Create key, destroy any allocated variable on thread exit */
    pthread_key_create(&__guac_error_message_key, __guac_mem_free_pointer);

}

guac_status* __guac_error() {

    /* Pointer for thread-local data */
    guac_status* status;

    /* Init error key, if not already initialized */
    pthread_once(&__guac_error_key_init, __guac_alloc_error_key);

    /* Retrieve thread-local status variable */
    status = (guac_status*) pthread_getspecific(__guac_error_key);

    /* Allocate thread-local status variable if not already allocated */
    if (status == NULL) {
        status = guac_mem_alloc(sizeof(guac_status));
        pthread_setspecific(__guac_error_key, status);
    }

    return status;

}

const char** __guac_error_message() {

    /* Pointer for thread-local data */
    const char** message;

    /* Init error message key, if not already initialized */
    pthread_once(
        &__guac_error_message_key_init,
        __guac_alloc_error_message_key
    );

    /* Retrieve thread-local message variable */
    message = (const char**) pthread_getspecific(__guac_error_message_key);

    /* Allocate thread-local message variable if not already allocated */
    if (message == NULL) {
        message = guac_mem_alloc(sizeof(const char*));
        pthread_setspecific(__guac_error_message_key, message);
    }

    return message;

}

#else

/* Default (not-threadsafe) implementation */
static guac_status __guac_error_unsafe_storage;
static const char** __guac_error_message_unsafe_storage;

guac_status* __guac_error() {
    return &__guac_error_unsafe_storage;
}

const char** __guac_error_message() {
    return &__guac_error_message_unsafe_storage;
}

/* Warn about threadsafety */
#warn No threadsafe implementation of __guac_error exists for your platform, so a default non-threadsafe implementation has been used instead. This may lead to incorrect status codes being reported for failures. Please consider adding support for your platform, or filing a bug report with the Guacamole project.

#endif

