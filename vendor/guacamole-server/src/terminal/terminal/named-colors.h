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

#ifndef GUAC_TERMINAL_NAMED_COLORS_H
#define GUAC_TERMINAL_NAMED_COLORS_H

/**
 * Function definitions for operating on individual terminal colors.
 *
 * @file named-colors.h
 */

#include "palette.h"

/**
 * Searches for the color having the given name, storing that color within the
 * given guac_terminal_color structure if found. If the color cannot be found,
 * the guac_terminal_color structure is not touched. All color names supported
 * by xterm are recognized by this function.
 *
 * @param name
 *     The name of the color to search for.
 *
 * @param color
 *     A pointer to the guac_terminal_color structure in which the found color
 *     should be stored.
 *
 * @returns
 *     Zero if the color was successfully found, non-zero otherwise.
 */
int guac_terminal_find_color(const char* name, guac_terminal_color* color);

#endif

