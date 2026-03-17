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

#ifndef _GUAC_POOL_TYPES_H
#define _GUAC_POOL_TYPES_H

/**
 * Type definitions related to the guac_pool pool of unique integers.
 *
 * @file pool-types.h
 */

/**
 * Represents a single integer within a larger pool of integers.
 */
typedef struct guac_pool_int guac_pool_int;

/**
 * A pool of integers. Integers can be removed from and later free'd back
 * into the pool. New integers are returned when the pool is exhausted,
 * or when the pool has not met some minimum size. Old, free'd integers
 * are returned otherwise.
 */
typedef struct guac_pool guac_pool;

#endif

