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

#ifndef GUACLOG_KEYDEF_H
#define GUACLOG_KEYDEF_H

#include "config.h"

#include <stdbool.h>

/**
 * A mapping of X11 keysym to its corresponding human-readable name.
 */
typedef struct guaclog_keydef {

    /**
     * The X11 keysym of the key.
     */
    int keysym;

    /**
     * A human-readable name for the key.
     */
    char* name;

    /**
     * The value which would be typed in a typical text editor, if any. If the
     * key is not associated with any typable value, or if the typable value is
     * not generally useful in an auditing context, this will be NULL.
     */
    char* value;

    /**
     * Whether this key is a modifier which may affect the interpretation of
     * other keys, and thus should be tracked as it is held down.
     */
    bool modifier;

} guaclog_keydef;

/**
 * Creates a new guaclog_keydef which represents the key having the given
 * keysym. The resulting guaclog_keydef must eventually be freed through a
 * call to guaclog_keydef_free().
 *
 * @param keysym
 *     The X11 keysym of the key.
 *
 * @return
 *     A new guaclog_keydef which represents the key having the given keysym,
 *     or NULL if no such key is known.
 */
guaclog_keydef* guaclog_keydef_alloc(int keysym);

/**
 * Frees all resources associated with the given guaclog_keydef. If the given
 * guaclog_keydef is NULL, this function has no effect.
 *
 * @param keydef
 *     The guaclog_keydef to free, which may be NULL.
 */
void guaclog_keydef_free(guaclog_keydef* keydef);

#endif

