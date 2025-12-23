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

#include "keyboard.h"

/**
 * The X11 keysym for the dead key which types a grave (`).
 */
#define DEAD_GRAVE 0xFE50

/**
 * The X11 keysym for the dead key which types an acute (´). Note that this is
 * NOT equivalent to an apostrophe or single quote.
 */
#define DEAD_ACUTE 0xFE51

/**
 * The X11 keysym for the dead key which types a circumflex/caret (^).
 */
#define DEAD_CIRCUMFLEX 0xFE52

/**
 * The X11 keysym for the dead key which types a tilde (~).
 */
#define DEAD_TILDE 0xFE53

/**
 * The X11 keysym for the dead key which types a dieresis/umlaut (¨).
 */
#define DEAD_DIERESIS 0xFE57

/**
 * The X11 keysym for the dead key which types an abovering (˚). Note that this
 * is NOT equivalent to the degree symbol.
 */
#define DEAD_ABOVERING 0xFE58

/**
 * The decomposed form of a key that can be typed using two keypresses: a dead
 * key followed by a base key. For example, on a keyboard which lacks a single
 * dedicated key for doing the same, "ó" would be typed using the dead acute
 * key followed by the "o" key. The dead key and base key are pressed and
 * released in sequence; they are not held down.
 */
typedef struct guac_rdp_decomposed_key {

    /**
     * The keysym of the dead key which must first be pressed and released to
     * begin typing the desired character. The dead key defines the diacritic
     * which will be applied to the character typed by the base key.
     */
    int dead_keysym;

    /**
     * The keysym of the base key which must be pressed and released to finish
     * typing the desired character. The base key defines the normal form of
     * the character (the form which lacks any diacritic) to which the
     * diacritic defined by the previously-pressed dead key will be applied.
     */
    int base_keysym;

} guac_rdp_decomposed_key;

/**
 * A lookup table of all known decomposed forms of various keysyms. Keysyms map
 * directly to entries within this table. A keysym which has no entry within
 * this table does not have a defined decomposed form (or at least does not
 * have a decomposed form relevant to RDP).
 */
guac_rdp_decomposed_key guac_rdp_decomposed_keys[256] = {

    /* ^ */ [0x005E] = { DEAD_CIRCUMFLEX, ' ' },
    /* ` */ [0x0060] = { DEAD_GRAVE,      ' ' },
    /* ~ */ [0x007E] = { DEAD_TILDE,      ' ' },
    /* ¨ */ [0x00A8] = { DEAD_DIERESIS,   ' ' },
    /* ´ */ [0x00B4] = { DEAD_ACUTE,      ' ' },
    /* À */ [0x00C0] = { DEAD_GRAVE,      'A' },
    /* Á */ [0x00C1] = { DEAD_ACUTE,      'A' },
    /* Â */ [0x00C2] = { DEAD_CIRCUMFLEX, 'A' },
    /* Ã */ [0x00C3] = { DEAD_TILDE,      'A' },
    /* Ä */ [0x00C4] = { DEAD_DIERESIS,   'A' },
    /* Å */ [0x00C5] = { DEAD_ABOVERING,  'A' },
    /* È */ [0x00C8] = { DEAD_GRAVE,      'E' },
    /* É */ [0x00C9] = { DEAD_ACUTE,      'E' },
    /* Ê */ [0x00CA] = { DEAD_CIRCUMFLEX, 'E' },
    /* Ë */ [0x00CB] = { DEAD_DIERESIS,   'E' },
    /* Ì */ [0x00CC] = { DEAD_GRAVE,      'I' },
    /* Í */ [0x00CD] = { DEAD_ACUTE,      'I' },
    /* Î */ [0x00CE] = { DEAD_CIRCUMFLEX, 'I' },
    /* Ï */ [0x00CF] = { DEAD_DIERESIS,   'I' },
    /* Ñ */ [0x00D1] = { DEAD_TILDE,      'N' },
    /* Ò */ [0x00D2] = { DEAD_GRAVE,      'O' },
    /* Ó */ [0x00D3] = { DEAD_ACUTE,      'O' },
    /* Ô */ [0x00D4] = { DEAD_CIRCUMFLEX, 'O' },
    /* Õ */ [0x00D5] = { DEAD_TILDE,      'O' },
    /* Ö */ [0x00D6] = { DEAD_DIERESIS,   'O' },
    /* Ù */ [0x00D9] = { DEAD_GRAVE,      'U' },
    /* Ú */ [0x00DA] = { DEAD_ACUTE,      'U' },
    /* Û */ [0x00DB] = { DEAD_CIRCUMFLEX, 'U' },
    /* Ü */ [0x00DC] = { DEAD_DIERESIS,   'U' },
    /* Ý */ [0x00DD] = { DEAD_ACUTE,      'Y' },
    /* à */ [0x00E0] = { DEAD_GRAVE,      'a' },
    /* á */ [0x00E1] = { DEAD_ACUTE,      'a' },
    /* â */ [0x00E2] = { DEAD_CIRCUMFLEX, 'a' },
    /* ã */ [0x00E3] = { DEAD_TILDE,      'a' },
    /* ä */ [0x00E4] = { DEAD_DIERESIS,   'a' },
    /* å */ [0x00E5] = { DEAD_ABOVERING,  'a' },
    /* è */ [0x00E8] = { DEAD_GRAVE,      'e' },
    /* é */ [0x00E9] = { DEAD_ACUTE,      'e' },
    /* ê */ [0x00EA] = { DEAD_CIRCUMFLEX, 'e' },
    /* ë */ [0x00EB] = { DEAD_DIERESIS,   'e' },
    /* ì */ [0x00EC] = { DEAD_GRAVE,      'i' },
    /* í */ [0x00ED] = { DEAD_ACUTE,      'i' },
    /* î */ [0x00EE] = { DEAD_CIRCUMFLEX, 'i' },
    /* ï */ [0x00EF] = { DEAD_DIERESIS,   'i' },
    /* ñ */ [0x00F1] = { DEAD_TILDE,      'n' },
    /* ò */ [0x00F2] = { DEAD_GRAVE,      'o' },
    /* ó */ [0x00F3] = { DEAD_ACUTE,      'o' },
    /* ô */ [0x00F4] = { DEAD_CIRCUMFLEX, 'o' },
    /* õ */ [0x00F5] = { DEAD_TILDE,      'o' },
    /* ö */ [0x00F6] = { DEAD_DIERESIS,   'o' },
    /* ù */ [0x00F9] = { DEAD_GRAVE,      'u' },
    /* ú */ [0x00FA] = { DEAD_ACUTE,      'u' },
    /* û */ [0x00FB] = { DEAD_CIRCUMFLEX, 'u' },
    /* ü */ [0x00FC] = { DEAD_DIERESIS,   'u' },
    /* ý */ [0x00FD] = { DEAD_ACUTE,      'y' },
    /* ÿ */ [0x00FF] = { DEAD_DIERESIS,   'y' } 

};

int guac_rdp_decompose_keysym(guac_rdp_keyboard* keyboard, int keysym) {

    /* Verify keysym is within range of lookup table */
    if (keysym < 0x00 || keysym > 0xFF)
        return 1;

    /* Verify keysym is actually defined within lookup table */
    guac_rdp_decomposed_key* key = &guac_rdp_decomposed_keys[keysym];
    if (!key->dead_keysym)
        return 1;

    /* Cannot type using decomposed keys if those keys are not defined within
     * the current layout */
    if (!guac_rdp_keyboard_is_defined(keyboard, key->dead_keysym)
            || !guac_rdp_keyboard_is_defined(keyboard, key->base_keysym))
        return 1;

    /* Press dead key */
    guac_rdp_keyboard_update_keysym(keyboard, key->dead_keysym, 1, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    guac_rdp_keyboard_update_keysym(keyboard, key->dead_keysym, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);

    /* Press base key */
    guac_rdp_keyboard_update_keysym(keyboard, key->base_keysym, 1, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    guac_rdp_keyboard_update_keysym(keyboard, key->base_keysym, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);

    /* Decomposed key successfully typed */
    return 0;

}

