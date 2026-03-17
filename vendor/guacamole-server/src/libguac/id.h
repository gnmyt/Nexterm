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

#ifndef __GUAC_ID_H
#define __GUAC_ID_H

/**
 * Generates a guaranteed-unique identifier which is a total of 37 characters
 * long, having the given single-character prefix. The resulting identifier
 * must be freed with a call to guac_mem_free() when no longer needed. If an error
 * occurs, NULL is returned, no memory is allocated, and guac_error is set
 * appropriately.
 *
 * @param prefix
 *     The single-character prefix to use.
 *
 * @return
 *     A newly-allocated unique identifier with the given prefix, or NULL if
 *     the identifier could not be generated.
 */
char* guac_generate_id(char prefix);

#endif

