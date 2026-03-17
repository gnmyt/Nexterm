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

#ifndef GUAC_FLAG_TYPES_H
#define GUAC_FLAG_TYPES_H

/**
 * Generic integer flag intended for signalling of arbitrary events between
 * processes. This flag may be safely included in shared memory, but must be
 * initialized with guac_flag_init().
 *
 * In addition to basic signalling and tracking of flag values, it is intended
 * that the locking/unlocking facilities of guac_flag may be used in
 * lieu of a mutex to guard concurrent access to any number of shared resources
 * related to the flag.
 */
typedef struct guac_flag guac_flag;

#endif

