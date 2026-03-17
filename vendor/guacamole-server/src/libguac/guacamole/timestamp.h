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

#ifndef _GUAC_TIMESTAMP_H
#define _GUAC_TIMESTAMP_H

/**
 * Provides functions and structures for creating timestamps.
 *
 * @file timestamp.h
 */

#include "timestamp-types.h"

/**
 * Returns an arbitrary timestamp. The difference between return values of any
 * two calls is equal to the amount of time in milliseconds between those 
 * calls. The return value from a single call will not have any useful
 * (or defined) meaning.
 *
 * @return
 *     An arbitrary millisecond timestamp.
 */
guac_timestamp guac_timestamp_current();

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param duration
 *     The number of milliseconds to sleep.
 */
void guac_timestamp_msleep(int duration);

#endif

