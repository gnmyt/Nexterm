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

#include "display-builtin-cursors.h"

/**
 * Opaque black. This macro evaluates to the 4 bytes of the single pixel of a
 * 32-bit ARGB image that represent opaque black and is expected to be used
 * only within this file to help make embedded cursor graphics more readable.
 */
#define X 0x00,0x00,0x00,0xFF

/**
 * Opaque gray. This macro evaluates to the 4 bytes of the single pixel of a
 * 32-bit ARGB image that represent opaque gray and is expected to be used only
 * within this file to help make embedded cursor graphics more readable.
 */
#define U 0x80,0x80,0x80,0xFF

/**
 * Opaque white. This macro evaluates to the 4 bytes of the single pixel of a
 * 32-bit ARGB image that represent opaque white and is expected to be used
 * only within this file to help make embedded cursor graphics more readable.
 */
#define O 0xFF,0xFF,0xFF,0xFF

/**
 * Full transparency. This macro evaluates to the 4 bytes of the single pixel
 * of a 32-bit ARGB image that represent full transparency and is expected to
 * be used only within this file to help make embedded cursor graphics more
 * readable.
 */
#define _ 0x00,0x00,0x00,0x00

const guac_display_builtin_cursor guac_display_cursor_none = {

    .hotspot_x = 0,
    .hotspot_y = 0,

    .buffer = (unsigned char[]) {
        _ /* Single, transparent pixel */
    },

    .width = 1,
    .height = 1,
    .stride = 4

};

const guac_display_builtin_cursor guac_display_cursor_dot = {

    .hotspot_x = 2,
    .hotspot_y = 2,

    .buffer = (unsigned char[]) {

        _,O,O,O,_,
        O,X,X,X,O,
        O,X,X,X,O,
        O,X,X,X,O,
        _,O,O,O,_

    },

    .width = 5,
    .height = 5,
    .stride = 20

};

const guac_display_builtin_cursor guac_display_cursor_ibar = {

    .hotspot_x = 3,
    .hotspot_y = 7,

    .buffer = (unsigned char[]) {

        X,X,X,X,X,X,X,
        X,O,O,U,O,O,X,
        X,X,X,O,X,X,X,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        _,_,X,O,X,_,_,
        X,X,X,O,X,X,X,
        X,O,O,U,O,O,X,
        X,X,X,X,X,X,X

    },

    .width = 7,
    .height = 16,
    .stride = 28

};

const guac_display_builtin_cursor guac_display_cursor_pointer = {

    .hotspot_x = 0,
    .hotspot_y = 0,

    .buffer = (unsigned char[]) {

        O,_,_,_,_,_,_,_,_,_,_,
        O,O,_,_,_,_,_,_,_,_,_,
        O,X,O,_,_,_,_,_,_,_,_,
        O,X,X,O,_,_,_,_,_,_,_,
        O,X,X,X,O,_,_,_,_,_,_,
        O,X,X,X,X,O,_,_,_,_,_,
        O,X,X,X,X,X,O,_,_,_,_,
        O,X,X,X,X,X,X,O,_,_,_,
        O,X,X,X,X,X,X,X,O,_,_,
        O,X,X,X,X,X,X,X,X,O,_,
        O,X,X,X,X,X,O,O,O,O,O,
        O,X,X,O,X,X,O,_,_,_,_,
        O,X,O,_,O,X,X,O,_,_,_,
        O,O,_,_,O,X,X,O,_,_,_,
        O,_,_,_,_,O,X,X,O,_,_,
        _,_,_,_,_,O,O,O,O,_,_

    },

    .width = 11,
    .height = 16,
    .stride = 44

};
