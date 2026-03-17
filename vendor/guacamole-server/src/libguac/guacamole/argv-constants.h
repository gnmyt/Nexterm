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

#ifndef GUAC_ARGV_CONSTANTS_H
#define GUAC_ARGV_CONSTANTS_H

/**
 * Constants related to automatic handling of received "argv" instructions.
 *
 * @file argv-constants.h
 */

/**
 * Option flag which declares to guac_argv_register() that the associated
 * argument should be processed exactly once. If multiple "argv" streams are
 * received for the argument, only the first such stream is processed.
 * Additional streams will be rejected.
 */
#define GUAC_ARGV_OPTION_ONCE 1

/**
 * Option flag which declares to guac_argv_register() that the values received
 * and accepted for the associated argument should be echoed to all connected
 * users via outbound "argv" streams.
 */
#define GUAC_ARGV_OPTION_ECHO 2

/**
 * The maximum number of bytes to allow for any argument value received via an
 * argv stream and processed using guac_argv_received(), including null
 * terminator.
 */
#define GUAC_ARGV_MAX_LENGTH 16384

/**
 * The maximum number of bytes to allow within the name of any argument
 * registered with guac_argv_register(), including null terminator.
 */
#define GUAC_ARGV_MAX_NAME_LENGTH 256 

/**
 * The maximum number of bytes to allow within the mimetype of any received
 * argument value passed to a callback registered with guac_argv_register(),
 * including null terminator.
 */
#define GUAC_ARGV_MAX_MIMETYPE_LENGTH 4096

/**
 * The maximum number of arguments that may be registered via guac_argv_await()
 * or guac_argv_await_async() before further argument registrations will fail.
 */
#define GUAC_ARGV_MAX_REGISTERED 128

#endif

