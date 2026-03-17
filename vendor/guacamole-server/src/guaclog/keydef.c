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

#include "config.h"
#include "keydef.h"
#include "log.h"

#include <guacamole/mem.h>
#include <guacamole/string.h>

#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * All known keys.
 */
const guaclog_keydef known_keys[] = {
    { 0xFE03, "AltGr", "", true },
    { 0xFF08, "Backspace" },
    { 0xFF09, "Tab" },
    { 0xFF0B, "Clear" },
    { 0xFF0D, "Return", "\n" },
    { 0xFF13, "Pause" },
    { 0xFF14, "Scroll" },
    { 0xFF15, "SysReq" },
    { 0xFF1B, "Escape" },
    { 0xFF50, "Home" },
    { 0xFF51, "Left" },
    { 0xFF52, "Up" },
    { 0xFF53, "Right" },
    { 0xFF54, "Down" },
    { 0xFF55, "Page Up" },
    { 0xFF56, "Page Down" },
    { 0xFF57, "End" },
    { 0xFF63, "Insert" },
    { 0xFF65, "Undo" },
    { 0xFF6A, "Help" },
    { 0xFF7F, "Num" },
    { 0xFF80, "Space", " " },
    { 0xFF8D, "Enter", "\n" },
    { 0xFF95, "Home" },
    { 0xFF96, "Left" },
    { 0xFF97, "Up" },
    { 0xFF98, "Right" },
    { 0xFF99, "Down" },
    { 0xFF9A, "Page Up" },
    { 0xFF9B, "Page Down" },
    { 0xFF9C, "End" },
    { 0xFF9E, "Insert" },
    { 0xFFAA, "*", "*" },
    { 0xFFAB, "+", "+" },
    { 0xFFAD, "-", "-" },
    { 0xFFAE, ".", "." },
    { 0xFFAF, "/", "/" },
    { 0xFFB0, "0", "0" },
    { 0xFFB1, "1", "1" },
    { 0xFFB2, "2", "2" },
    { 0xFFB3, "3", "3" },
    { 0xFFB4, "4", "4" },
    { 0xFFB5, "5", "5" },
    { 0xFFB6, "6", "6" },
    { 0xFFB7, "7", "7" },
    { 0xFFB8, "8", "8" },
    { 0xFFB9, "9", "9" },
    { 0xFFBE, "F1" },
    { 0xFFBF, "F2" },
    { 0xFFC0, "F3" },
    { 0xFFC1, "F4" },
    { 0xFFC2, "F5" },
    { 0xFFC3, "F6" },
    { 0xFFC4, "F7" },
    { 0xFFC5, "F8" },
    { 0xFFC6, "F9" },
    { 0xFFC7, "F10" },
    { 0xFFC8, "F11" },
    { 0xFFC9, "F12" },
    { 0xFFCA, "F13" },
    { 0xFFCB, "F14" },
    { 0xFFCC, "F15" },
    { 0xFFCD, "F16" },
    { 0xFFCE, "F17" },
    { 0xFFCF, "F18" },
    { 0xFFD0, "F19" },
    { 0xFFD1, "F20" },
    { 0xFFD2, "F21" },
    { 0xFFD3, "F22" },
    { 0xFFD4, "F23" },
    { 0xFFD5, "F24" },
    { 0xFFE1, "Shift", "", true },
    { 0xFFE2, "Shift", "", true },
    { 0xFFE3, "Ctrl", NULL, true },
    { 0xFFE4, "Ctrl", NULL, true },
    { 0xFFE5, "Caps" },
    { 0xFFE7, "Meta", NULL, true },
    { 0xFFE8, "Meta", NULL, true },
    { 0xFFE9, "Alt", NULL, true },
    { 0xFFEA, "Alt", NULL, true },
    { 0xFFEB, "Super", NULL, true },
    { 0xFFEC, "Super", NULL, true },
    { 0xFFED, "Hyper", NULL, true },
    { 0xFFEE, "Hyper", NULL, true },
    { 0xFFFF, "Delete" }
};

/**
 * Comparator for the standard bsearch() function which compares an integer
 * keysym against the keysym associated with a guaclog_keydef.
 *
 * @param key
 *     The key value being compared against the member. This MUST be the
 *     keysym value, passed through typecasting to an intptr_t (NOT a pointer
 *     to the int itself).
 *
 * @param member
 *     The member within the known_keys array being compared against the given
 *     key.
 *
 * @return
 *     Zero if the given keysym is equal to that of the given member, a
 *     positive value if the given keysym is greater than that of the given
 *     member, or a negative value if the given keysym is less than that of the
 *     given member.
 */
static int guaclog_keydef_bsearch_compare(const void* key,
        const void* member) {

    int keysym = (int) ((intptr_t) key);
    guaclog_keydef* current = (guaclog_keydef*) member;

    /* Compare given keysym to keysym of current member */
    return keysym  - current->keysym;

}

/**
 * Searches through the known_keys array of known keys for the name of the key
 * having the given keysym, returning a pointer to the static guaclog_keydef
 * within the array if found.
 *
 * @param keysym
 *     The X11 keysym of the key.
 *
 * @return
 *     A pointer to the static guaclog_keydef associated with the given keysym,
 *     or NULL if the key could not be found.
 */
static guaclog_keydef* guaclog_get_known_key(int keysym) {

    /* Search through known keys for given keysym */
    return bsearch((void*) ((intptr_t) keysym),
            known_keys, sizeof(known_keys) / sizeof(known_keys[0]),
            sizeof(known_keys[0]), guaclog_keydef_bsearch_compare);

}

/**
 * Returns a statically-allocated guaclog_keydef representing an unknown key,
 * deriving the name of the key from the hexadecimal value of the keysym.
 *
 * @param keysym
 *     The X11 keysym of the key.
 *
 * @return
 *     A statically-allocated guaclog_keydef representing the key associated
 *     with the given keysym.
 */
static guaclog_keydef* guaclog_get_unknown_key(int keysym) {

    static char unknown_keydef_name[64];
    static guaclog_keydef unknown_keydef;

    /* Write keysym as hex */
    int size = snprintf(unknown_keydef_name, sizeof(unknown_keydef_name),
            "0x%X", keysym);

    /* Hex string is guaranteed to fit within the provided 64 bytes */
    assert(size < sizeof(unknown_keydef_name));

    /* Return static key definition */
    unknown_keydef.keysym = keysym;
    unknown_keydef.name = unknown_keydef_name;
    return &unknown_keydef;

}

/**
 * Returns a statically-allocated guaclog_keydef representing the key
 * associated with the given keysym, deriving the name and value of the key
 * using its corresponding Unicode character.
 *
 * @param keysym
 *     The X11 keysym of the key.
 *
 * @return
 *     A statically-allocated guaclog_keydef representing the key associated
 *     with the given keysym, or NULL if the given keysym has no corresponding
 *     Unicode character.
 */
static guaclog_keydef* guaclog_get_unicode_key(int keysym) {

    static char unicode_keydef_name[8];

    static guaclog_keydef unicode_keydef;

    int i;
    int mask, bytes;

    /* Translate only if keysym maps to Unicode */
    if (keysym < 0x00 || (keysym > 0xFF && (keysym | 0xFFFF) != 0x0100FFFF))
        return NULL;

    int codepoint = keysym & 0xFFFF;

    /* Determine size and initial byte mask */
    if (codepoint <= 0x007F) {
        mask  = 0x00;
        bytes = 1;
    }
    else if (codepoint <= 0x7FF) {
        mask  = 0xC0;
        bytes = 2;
    }
    else {
        assert(codepoint <= 0xFFFF);
        mask  = 0xE0;
        bytes = 3;
    }

    /* Offset buffer by size */
    char* key_name = unicode_keydef_name + bytes;

    /* Add null terminator */
    *(key_name--) = '\0';

    /* Add trailing bytes, if any */
    for (i=1; i<bytes; i++) {
        *(key_name--) = 0x80 | (codepoint & 0x3F);
        codepoint >>= 6;
    }

    /* Set initial byte */
    *key_name = mask | codepoint;

    /* Return static key definition */
    unicode_keydef.keysym = keysym;
    unicode_keydef.name = unicode_keydef.value = unicode_keydef_name;
    unicode_keydef.modifier = false;
    return &unicode_keydef;

}

/**
 * Copies the given guaclog_keydef into a newly-allocated guaclog_keydef
 * structure. The resulting guaclog_keydef must eventually be freed through a
 * call to guaclog_keydef_free().
 *
 * @param keydef
 *     The guaclog_keydef to copy.
 *
 * @return
 *     A newly-allocated guaclog_keydef structure copied from the given
 *     guaclog_keydef.
 */
static guaclog_keydef* guaclog_copy_key(guaclog_keydef* keydef) {

    guaclog_keydef* copy = guac_mem_alloc(sizeof(guaclog_keydef));

    /* Always copy keysym and name */
    copy->keysym = keydef->keysym;
    copy->name = guac_strdup(keydef->name);
    copy->modifier = keydef->modifier;

    /* Copy value only if defined */
    if (keydef->value != NULL)
        copy->value = guac_strdup(keydef->value);
    else
        copy->value = NULL;

    return copy;

}

guaclog_keydef* guaclog_keydef_alloc(int keysym) {

    guaclog_keydef* keydef;

    /* Check list of known keys first */
    keydef = guaclog_get_known_key(keysym);
    if (keydef != NULL)
        return guaclog_copy_key(keydef);

    /* Failing that, attempt to translate straight into a Unicode character */
    keydef = guaclog_get_unicode_key(keysym);
    if (keydef != NULL)
        return guaclog_copy_key(keydef);

    /* Key not known */
    guaclog_log(GUAC_LOG_DEBUG, "Definition not found for key 0x%X.", keysym);
    return guaclog_copy_key(guaclog_get_unknown_key(keysym));

}

void guaclog_keydef_free(guaclog_keydef* keydef) {

    /* Ignore NULL keydef */
    if (keydef == NULL)
        return;

    guac_mem_free(keydef->name);
    guac_mem_free(keydef->value);
    guac_mem_free(keydef);

}

