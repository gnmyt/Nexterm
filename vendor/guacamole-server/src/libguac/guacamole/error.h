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

#ifndef _GUAC_ERROR_H
#define _GUAC_ERROR_H

/**
 * Provides functions and structures required for handling return values and
 * errors.
 *
 * @file error.h
 */

#include "error-types.h"

/**
 * Returns a human-readable explanation of the status code given.
 */
const char* guac_status_string(guac_status status);

/**
 * Returns the status code associated with the error which occurred during the
 * last function call. This value will only be set by functions documented to
 * use it (most libguac functions), and is undefined if no error occurred.
 *
 * The storage of this value is thread-local. Assignment of a status code to
 * guac_error in one thread will not affect its value in another thread.
 */
#define guac_error (*__guac_error())

guac_status* __guac_error();

/**
 * Returns a message describing the error which occurred during the last
 * function call. If an error occurred, but no message is associated with it,
 * NULL is returned. This value is undefined if no error occurred.
 *
 * The storage of this value is thread-local. Assignment of a message to
 * guac_error_message in one thread will not affect its value in another
 * thread.
 */
#define guac_error_message (*__guac_error_message())

const char** __guac_error_message();

/**
 * Returns a human-readable explanation of the status code given.
 */
const char* guac_status_string(guac_status status);

/**
 * Returns the status code associated with the error which occurred during the
 * last function call. This value will only be set by functions documented to
 * use it (most libguac functions), and is undefined if no error occurred.
 *
 * The storage of this value is thread-local. Assignment of a status code to
 * guac_error in one thread will not affect its value in another thread.
 */
#define guac_error (*__guac_error())

guac_status* __guac_error();

/**
 * Returns a message describing the error which occurred during the last
 * function call. If an error occurred, but no message is associated with it,
 * NULL is returned. This value is undefined if no error occurred.
 *
 * The storage of this value is thread-local. Assignment of a message to
 * guac_error_message in one thread will not affect its value in another
 * thread.
 */
#define guac_error_message (*__guac_error_message())

const char** __guac_error_message();

#endif

