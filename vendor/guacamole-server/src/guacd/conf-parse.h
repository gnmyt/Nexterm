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

#ifndef _GUACD_CONF_PARSE_H
#define _GUACD_CONF_PARSE_H

/**
 * The maximum length of a name, in characters.
 */
#define GUACD_CONF_MAX_NAME_LENGTH 255

/**
 * The maximum length of a value, in characters.
 */
#define GUACD_CONF_MAX_VALUE_LENGTH 8191 

/**
 * A callback function which is provided to guacd_parse_conf() and is called
 * for each parameter/value pair set. The current section is always given. This
 * function will not be called for parameters outside of sections, which are
 * illegal.
 */
typedef int guacd_param_callback(const char* section, const char* param, const char* value, void* data);

/**
 * Parses an arbitrary buffer of configuration file data, calling the given
 * callback for each valid parameter/value pair. Upon success, the number of
 * characters parsed is returned. On failure, a negative value is returned, and
 * guacd_conf_parse_error and guacd_conf_parse_error_location are set. The
 * provided data will be passed to the callback for each invocation.
 */
int guacd_parse_conf(guacd_param_callback* callback, char* buffer, int length, void* data);

/**
 * Parses the given level name, returning the corresponding log level, or -1 if
 * no such log level exists.
 */
int guacd_parse_log_level(const char* name);

/**
 * Human-readable description of the current error, if any.
 */
extern char* guacd_conf_parse_error;

/**
 * The location of the most recent parse error. This will be a pointer to the
 * location of the error within the buffer passed to guacd_parse_conf().
 */
extern char* guacd_conf_parse_error_location;

#endif

