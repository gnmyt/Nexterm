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

#ifndef GUAC_ARGV_H
#define GUAC_ARGV_H

/**
 * Convenience functions for processing parameter values that are submitted
 * dynamically using "argv" instructions.
 *
 * @file argv.h
 */

#include "argv-constants.h"
#include "argv-fntypes.h"
#include "stream-types.h"
#include "user-fntypes.h"

/**
 * Registers the given callback such that it is automatically invoked when an
 * "argv" stream for an argument having the given name is processed using
 * guac_argv_received(). The maximum number of arguments that may be registered
 * in this way is limited by GUAC_ARGV_MAX_REGISTERED. The maximum length of
 * any provided argument name is limited by GUAC_ARGV_MAX_NAME_LENGTH.
 *
 * @see GUAC_ARGV_MAX_NAME_LENGTH
 * @see GUAC_ARGV_MAX_REGISTERED
 *
 * @see GUAC_ARGV_OPTION_ONCE
 * @see GUAC_ARGV_OPTION_ECHO
 *
 * @param name
 *     The name of the argument that should be handled by the given callback.
 *
 * @param callback
 *     The callback to invoke when the value of an argument having the given
 *     name has finished being received.
 *
 * @param data
 *     Arbitrary data to be passed to the given callback when a value is
 *     received for the given argument.
 *
 * @param options
 *     Bitwise OR of all option flags that should affect processing of this
 *     argument.
 *
 * @return
 *     Zero if the callback was successfully registered, non-zero if the
 *     maximum number of registered callbacks has already been reached.
 */
int guac_argv_register(const char* name, guac_argv_callback* callback, void* data, int options);

/**
 * Waits for receipt of each of the given arguments via guac_argv_received().
 * This function will block until either ALL of the given arguments have been
 * received via guac_argv_received() or until automatic processing of received
 * arguments is stopped with guac_argv_stop().
 *
 * @param args
 *     A NULL-terminated array of the names of all arguments that this function
 *     should wait for.
 *
 * @return
 *     Zero if all of the specified arguments were received, non-zero if
 *     guac_argv_stop() was called before all arguments were received.
 */
int guac_argv_await(const char** args);

/**
 * Hands off management of the given guac_stream, automatically processing data
 * received over that stream as the value of the argument having the given
 * name. The argument must have already been registered with
 * guac_argv_register(). The blob_handler and end_handler of the given stream,
 * if already set, will be overridden without regard to their current value.
 *
 * It is the responsibility of the caller to properly send any required "ack"
 * instructions to accept or reject the received stream.
 *
 * @param stream
 *     The guac_stream that will receive the value of the argument having the
 *     given name.
 *
 * @param mimetype
 *     The mimetype of the data that will be received over the stream.
 *
 * @param name
 *     The name of the argument being received.
 *
 * @return
 *     Zero if handling of the guac_stream has been successfully handed off,
 *     non-zero if the provided argument has not yet been registered with
 *     guac_argv_register().
 */
int guac_argv_received(guac_stream* stream, const char* mimetype, const char* name);

/**
 * Stops further automatic processing of received "argv" streams. Any call to
 * guac_argv_await() that is currently blocking will return, and any future
 * calls to guac_argv_await() will return immediately without blocking.
 */
void guac_argv_stop();

/**
 * Convenience implementation of the "argv" instruction handler which
 * automatically sends any required "ack" instructions and invokes
 * guac_argv_received(). Only arguments that are registered with
 * guac_argv_register() will be processed.
 */
guac_user_argv_handler guac_argv_handler;

#endif

