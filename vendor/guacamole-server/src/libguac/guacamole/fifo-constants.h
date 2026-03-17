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

#ifndef GUAC_FIFO_CONSTANTS_H
#define GUAC_FIFO_CONSTANTS_H

/**
 * @addtogroup fifo
 * @{
 */

/**
 * Provides constants for the abstract FIFO implementation (guac_fifo).
 *
 * @file fifo-constants.h
 */

/**
 * The bitwise flag used by the "state" member of guac_fifo to represent that
 * the fifo has space for at least one item.
 */
#define GUAC_FIFO_STATE_READY 1

/**
 * The bitwise flag used by the "state" member of guac_fifo to represent that
 * the fifo contains at least one item.
 */
#define GUAC_FIFO_STATE_NONEMPTY 2

/**
 * The bitwise flag used by the "state" member of guac_fifo to represent that
 * the fifo is no longer valid and may not be used for any further operations.
 */
#define GUAC_FIFO_STATE_INVALID 4

/**
 * @}
 */

#endif

