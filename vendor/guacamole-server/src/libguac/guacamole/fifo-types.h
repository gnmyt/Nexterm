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

#ifndef GUAC_FIFO_TYPES_H
#define GUAC_FIFO_TYPES_H

/**
 * @addtogroup fifo
 * @{
 */

/**
 * Provides type definitions for the abstract FIFO implementation (guac_fifo).
 *
 * @file fifo-types.h
 */

/**
 * Generic base structure for a FIFO of arbitrary events. The size of the FIFO
 * and each event are up to the implementation. Each implementation must
 * provide this base structure with a pointer to the underlying array of items,
 * the maximum number of items supported, and the size in bytes of each item
 * through a call to guac_fifo_init().
 *
 * This generic base may be safely included in shared memory, but
 * implementations building off this base must ensure the base is initialized
 * with a call to guac_fifo_init() and that any additional
 * implementation-specific aspects are also safe for shared memory usage.
 */
typedef struct guac_fifo guac_fifo;

/**
 * @}
 */

#endif

