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

#ifndef GUAC_TERMINAL_XPARSECOLOR_H
#define GUAC_TERMINAL_XPARSECOLOR_H

/**
 * Function definitions related to handling X11 color specs.
 *
 * @file xparsecolor.h
 */

#include "palette.h"

/**
 * Parses an X11 color spec, as defined by Xlib's XParseColor(), storing the
 * result in the provided guac_terminal_color structure. If the color spec is
 * not valid, the provided guac_terminal_color is not touched.
 *
 * Currently, only the "rgb:*" format color specs are supported.
 *
 * @param spec
 *     The X11 color spec to parse.
 *
 * @param color
 *     A pointer to the guac_terminal_color structure which should receive the
 *     parsed result.
 *
 * @returns
 *     Zero if the color spec was successfully parsed, non-zero otherwise.
 */
int guac_terminal_xparsecolor(const char* spec,
        guac_terminal_color* color);

#endif

