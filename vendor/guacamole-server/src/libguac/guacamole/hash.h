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

#ifndef _GUAC_HASH_H
#define _GUAC_HASH_H

/**
 * Provides functions and structures for producing likely-to-be-unique hash
 * values for images.
 *
 * @file hash.h
 */

#include <cairo/cairo.h>

/**
 * Produces a 24-bit hash value from all pixels of the given surface. The
 * surface provided must be RGB or ARGB with each pixel stored in 32 bits.
 * The hashing algorithm used is a variant of the cyclic polynomial rolling
 * hash.
 *
 * @param surface The Cairo surface to hash.
 * @return An arbitrary 24-bit unsigned integer value intended to be well
 *         distributed across different images.
 */
unsigned int guac_hash_surface(cairo_surface_t* surface);

/**
 * Given two Cairo surfaces, returns zero if the data contained within each
 * is identical, and a positive or negative value if the value of the first
 * is found to be lexically greater or less than the second respectively.
 *
 * @param a The first Cairo surface to compare.
 * @param b The Cairo surface to compare the first surface against.
 * @return Zero if the data contained within each is identical, and a positive
 *         or negative value if the value of the first is found to be lexically
 *         greater or less than the second respectively.
 */
int guac_surface_cmp(cairo_surface_t* a, cairo_surface_t* b);

#endif

