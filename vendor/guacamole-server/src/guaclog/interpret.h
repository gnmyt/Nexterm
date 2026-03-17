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

#ifndef GUACLOG_INTERPRET_H
#define GUACLOG_INTERPRET_H

#include "config.h"

#include <stdbool.h>

/**
 * Interprets all input events within the given Guacamole protocol dump,
 * producing a human-readable log of those input events. A read lock will be
 * acquired on the input file to ensure that in-progress logs are not
 * interpreted. This behavior can be overridden by specifying true for the
 * force parameter.
 *
 * @param path
 *     The path to the file containing the raw Guacamole protocol dump.
 *
 * @param out_path
 *     The full path to the file in which interpreted log should be written.
 *
 * @param force
 *     Interpret even if the input file appears to be an in-progress log (has
 *     an associated lock).
 *
 * @return
 *     Zero on success, non-zero if an error prevented successful
 *     interpretation of the log.
 */
int guaclog_interpret(const char* path, const char* out_path, bool force);

#endif

