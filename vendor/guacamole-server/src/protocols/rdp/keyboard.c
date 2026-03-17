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

#include "decompose.h"
#include "keyboard.h"
#include "keymap.h"
#include "rdp.h"

#include <freerdp/freerdp.h>
#include <freerdp/input.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/rwlock.h>

#include <stdlib.h>

/**
 * Translates the given keysym into the corresponding lock flag, as would be
 * required by the RDP synchronize event. If the given keysym does not
 * represent a lock key, zero is returned.
 *
 * @param keysym
 *     The keysym to translate into a RDP lock flag.
 *
 * @return
 *     The RDP lock flag which corresponds to the given keysym, or zero if the
 *     given keysym does not represent a lock key.
 */
static int guac_rdp_keyboard_lock_flag(int keysym) {

    /* Translate keysym into corresponding lock flag */
    switch (keysym) {

        /* Scroll lock */
        case GUAC_RDP_KEYSYM_SCROLL_LOCK:
            return KBD_SYNC_SCROLL_LOCK;

        /* Kana lock */
        case GUAC_RDP_KEYSYM_KANA_LOCK:
            return KBD_SYNC_KANA_LOCK;

        /* Num lock */
        case GUAC_RDP_KEYSYM_NUM_LOCK:
            return KBD_SYNC_NUM_LOCK;

        /* Caps lock */
        case GUAC_RDP_KEYSYM_CAPS_LOCK:
            return KBD_SYNC_CAPS_LOCK;

    }

    /* Not a lock key */
    return 0;

}

/**
 * Immediately sends an RDP key event having the given scancode and flags.
 *
 * @param rdp_client
 *     The RDP client instance associated with the RDP session along which the
 *     key event should be sent.
 *
 * @param scancode
 *     The scancode of the key to press or release via the RDP key event.
 *
 * @param flags
 *     Any RDP-specific flags required for the provided scancode to have the
 *     intended meaning, such as KBD_FLAGS_EXTENDED. The possible flags and
 *     their meanings are dictated by RDP. KBD_FLAGS_DOWN and KBD_FLAGS_UP
 *     need not be specified here - they will automatically be added depending
 *     on the value specified for the pressed parameter.
 *
 * @param pressed
 *     Non-zero if the key is being pressed, zero if the key is being released.
 */
static void guac_rdp_send_key_event(guac_rdp_client* rdp_client,
        int scancode, int flags, int pressed) {

    /* Determine proper event flag for pressed state */
    int pressed_flags;
    if (pressed)
        pressed_flags = KBD_FLAGS_DOWN;
    else
        pressed_flags = KBD_FLAGS_RELEASE;

    /* Skip if not yet connected */
    freerdp* rdp_inst = rdp_client->rdp_inst;
    if (rdp_inst == NULL)
        return;

    /* Send actual key */
    pthread_mutex_lock(&(rdp_client->message_lock));
    GUAC_RDP_CONTEXT(rdp_inst)->input->KeyboardEvent(
            GUAC_RDP_CONTEXT(rdp_inst)->input, flags | pressed_flags, scancode);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

/**
 * Immediately sends an RDP Unicode event having the given Unicode codepoint.
 * Unlike key events, RDP Unicode events do have not a pressed or released
 * state. They represent strictly the input of a single character, and are
 * technically independent of the keyboard.
 *
 * @param rdp_client
 *     The RDP client instance associated with the RDP session along which the
 *     Unicode event should be sent.
 *
 * @param codepoint
 *     The Unicode codepoint of the character being input via the Unicode
 *     event.
 */
static void guac_rdp_send_unicode_event(guac_rdp_client* rdp_client,
        int codepoint) {

    /* Skip if not yet connected */
    freerdp* rdp_inst = rdp_client->rdp_inst;
    if (rdp_inst == NULL)
        return;

    /* Send Unicode event */
    pthread_mutex_lock(&(rdp_client->message_lock));
    GUAC_RDP_CONTEXT(rdp_inst)->input->UnicodeKeyboardEvent(
            GUAC_RDP_CONTEXT(rdp_inst)->input, 0, codepoint);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

/**
 * Immediately sends an RDP synchronize event having the given flags. An RDP
 * synchronize event sets the state of remote lock keys absolutely, where a
 * lock key will be active only if its corresponding flag is set in the event.
 *
 * @param rdp_client
 *     The RDP client instance associated with the RDP session along which the
 *     synchronize event should be sent.
 *
 * @param flags
 *     Bitwise OR of the flags representing the lock keys which should be set,
 *     if any, as dictated by the RDP protocol. If no flags are set, then no
 *     lock keys will be active.
 */
static void guac_rdp_send_synchronize_event(guac_rdp_client* rdp_client,
        UINT32 flags) {

    /* Skip if not yet connected */
    freerdp* rdp_inst = rdp_client->rdp_inst;
    if (rdp_inst == NULL)
        return;

    /* Synchronize lock key states */
    pthread_mutex_lock(&(rdp_client->message_lock));
    GUAC_RDP_CONTEXT(rdp_inst)->input->SynchronizeEvent(
            GUAC_RDP_CONTEXT(rdp_inst)->input, flags);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

/**
 * Given a keyboard instance and X11 keysym, returns a pointer to the
 * keys_by_keysym entry that represents the key having that keysym within the
 * keyboard, regardless of whether the key is currently defined. If no such key
 * can exist (the keysym cannot be mapped or is out of range), NULL is
 * returned.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param keysym
 *     The keysym of the key to lookup within the given keyboard.
 *
 * @return
 *     A pointer to the keys_by_keysym entry which represents or can represent
 *     the key having the given keysym, or NULL if no such keysym can be
 *     defined within a guac_rdp_keyboard structure.
 */
static guac_rdp_key** guac_rdp_keyboard_map_key(guac_rdp_keyboard* keyboard,
        int keysym) {

    int index;

    /* Map keysyms between 0x0000 and 0xFFFF directly */
    if (keysym >= 0x0000 && keysym <= 0xFFFF)
        index = keysym;

    /* Map all Unicode keysyms from U+0000 to U+FFFF */
    else if (keysym >= 0x1000000 && keysym <= 0x100FFFF)
        index = 0x10000 + (keysym & 0xFFFF);

    /* All other keysyms are unmapped */
    else
        return NULL;

    /* Corresponding key mapping (defined or not) has been located */
    return &(keyboard->keys_by_keysym[index]);

}

/**
 * Returns the number of bits that are set within the given integer (the number
 * of 1s in the binary expansion of the given integer).
 *
 * @param value
 *     The integer to read.
 *
 * @return
 *     The number of bits that are set within the given integer.
 */
static int guac_rdp_count_bits(unsigned int value) {

    int bits = 0;

    while (value) {
        bits += value & 1;
        value >>= 1;
    }

    return bits;

}

/**
 * Returns an estimated cost for sending the necessary RDP events to type the
 * key described by the given guac_rdp_keysym_desc, given the current lock and
 * modifier state of the keyboard. A higher cost value indicates that a greater
 * number of events are expected to be required.
 *
 * Lower-cost approaches should be preferred when multiple alternatives exist
 * for typing a particular key, as the lower cost implies fewer additional key
 * events required to produce the expected behavior. For example, if Caps Lock
 * is enabled, typing an uppercase "A" by pressing the "A" key has a lower cost
 * than disabling Caps Lock and pressing Shift+A.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param def
 *     The guac_rdp_keysym_desc that describes the key being pressed, as well
 *     as any requirements that must be satisfied for the key to be interpreted
 *     as expected.
 *
 * @return
 *     An arbitrary integer value which indicates the overall estimated
 *     complexity of typing the given key.
 */
static int guac_rdp_keyboard_get_cost(guac_rdp_keyboard* keyboard,
        const guac_rdp_keysym_desc* def) {

    unsigned int modifier_flags = guac_rdp_keyboard_get_modifier_flags(keyboard);

    /* Each change to any key requires one event, by definition */
    int cost = 1;

    /* Each change to a lock requires roughly two key events */
    unsigned int update_locks = (def->set_locks & ~keyboard->lock_flags) | (def->clear_locks & keyboard->lock_flags);
    cost += guac_rdp_count_bits(update_locks) * 2;

    /* Each change to a modifier requires one key event */
    unsigned int update_modifiers = (def->clear_modifiers & modifier_flags) | (def->set_modifiers & ~modifier_flags);
    cost += guac_rdp_count_bits(update_modifiers);

    return cost;

}

/**
 * Returns a pointer to the guac_rdp_key structure representing the
 * definition(s) and state of the key having the given keysym. If no such key
 * is defined within the keyboard layout of the RDP server, NULL is returned.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param keysym
 *     The keysym of the key to lookup within the given keyboard.
 *
 * @return
 *     A pointer to the guac_rdp_key structure representing the definition(s)
 *     and state of the key having the given keysym, or NULL if no such key is
 *     defined within the keyboard layout of the RDP server.
 */
static guac_rdp_key* guac_rdp_keyboard_get_key(guac_rdp_keyboard* keyboard,
        int keysym) {

    /* Verify that the key is actually defined */
    guac_rdp_key** key_by_keysym = guac_rdp_keyboard_map_key(keyboard, keysym);
    if (key_by_keysym == NULL)
        return NULL;

    return *key_by_keysym;

}

/**
 * Given a key which may have multiple possible definitions, returns the
 * definition that currently has the lowest cost, taking into account the
 * current keyboard lock and modifier states.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param key
 *     The key whose lowest-cost possible definition should be retrieved.
 *
 * @return
 *     A pointer to the guac_rdp_keysym_desc which defines the current
 *     lowest-cost method of typing the given key.
 */
static const guac_rdp_keysym_desc* guac_rdp_keyboard_get_definition(guac_rdp_keyboard* keyboard,
        guac_rdp_key* key) {

    /* Consistently map the same entry so long as the key is held */
    if (key->pressed != NULL)
        return key->pressed;

    /* Calculate cost of first definition of key (there must always be at least
     * one definition) */
    const guac_rdp_keysym_desc* best_def = key->definitions[0];
    int best_cost = guac_rdp_keyboard_get_cost(keyboard, best_def);

    /* If further definitions exist, choose the definition with the lowest
     * overall cost */
    for (int i = 1; i < key->num_definitions; i++) {

        const guac_rdp_keysym_desc* def = key->definitions[i];
        int cost = guac_rdp_keyboard_get_cost(keyboard, def);

        if (cost < best_cost) {
            best_def = def;
            best_cost = cost;
        }

    }

    return best_def;

}

/**
 * Adds the keysym/scancode mapping described by the given guac_rdp_keysym_desc
 * to the internal mapping of the keyboard. If insufficient space remains for
 * additional keysyms, or the given keysym has already reached the maximum
 * number of possible definitions, the mapping is ignored and the failure is
 * logged.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param mapping
 *     The keysym/scancode mapping that should be added to the given keyboard.
 */
static void guac_rdp_keyboard_add_mapping(guac_rdp_keyboard* keyboard,
        const guac_rdp_keysym_desc* mapping) {

    /* Locate corresponding keysym-to-key translation entry within keyboard
     * structure */
    guac_rdp_key** key_by_keysym = guac_rdp_keyboard_map_key(keyboard, mapping->keysym);
    if (key_by_keysym == NULL) {
        guac_client_log(keyboard->client, GUAC_LOG_DEBUG, "Ignoring unmappable keysym 0x%X", mapping->keysym);
        return;
    }

    /* If not yet pointing to a key, point keysym-to-key translation entry at
     * next available storage */
    if (*key_by_keysym == NULL) {

        if (keyboard->num_keys == GUAC_RDP_KEYBOARD_MAX_KEYSYMS) {
            guac_client_log(keyboard->client, GUAC_LOG_DEBUG, "Key definition "
                    "for keysym 0x%X dropped: Keymap exceeds maximum "
                    "supported number of keysyms",
                    mapping->keysym);
            return;
        }

        *key_by_keysym = &keyboard->keys[keyboard->num_keys++];

    }

    guac_rdp_key* key = *key_by_keysym;

    /* Add new definition only if sufficient space remains */
    if (key->num_definitions == GUAC_RDP_KEY_MAX_DEFINITIONS) {
        guac_client_log(keyboard->client, GUAC_LOG_DEBUG, "Key definition "
                "for keysym 0x%X dropped: Maximum number of possible "
                "definitions has been reached for this keysym",
                mapping->keysym);
        return;
    }

    /* Store new possible definition of key */
    key->definitions[key->num_definitions++] = mapping;

}

/**
 * Loads all keysym/scancode mappings declared within the given keymap and its
 * parent keymap, if any. These mappings are stored within the given
 * guac_rdp_keyboard structure for future use in translating keysyms to the
 * scancodes required by RDP key events.
 *
 * @param keyboard
 *     The guac_rdp_keyboard which should be initialized with the
 *     keysym/scancode mapping defined in the given keymap.
 *
 * @param keymap
 *     The keymap to use to populate the given client's keysym/scancode
 *     mapping.
 */
static void guac_rdp_keyboard_load_keymap(guac_rdp_keyboard* keyboard,
        const guac_rdp_keymap* keymap) {

    /* If parent exists, load parent first */
    if (keymap->parent != NULL)
        guac_rdp_keyboard_load_keymap(keyboard, keymap->parent);

    /* Log load */
    guac_client_log(keyboard->client, GUAC_LOG_INFO,
            "Loading keymap \"%s\"", keymap->name);

    /* Copy mapping into keymap */
    const guac_rdp_keysym_desc* mapping = keymap->mapping;
    while (mapping->keysym != 0) {
        guac_rdp_keyboard_add_mapping(keyboard, mapping++);
    }

}

guac_rdp_keyboard* guac_rdp_keyboard_alloc(guac_client* client,
        const guac_rdp_keymap* keymap) {

    guac_rdp_keyboard* keyboard = guac_mem_zalloc(sizeof(guac_rdp_keyboard));
    keyboard->client = client;

    /* Load keymap into keyboard */
    guac_rdp_keyboard_load_keymap(keyboard, keymap);

    return keyboard;

}

void guac_rdp_keyboard_free(guac_rdp_keyboard* keyboard) {
    guac_mem_free(keyboard);
}

int guac_rdp_keyboard_is_defined(guac_rdp_keyboard* keyboard, int keysym) {

    /* Return whether the mapping actually exists */
    return guac_rdp_keyboard_get_key(keyboard, keysym) != NULL;

}

int guac_rdp_keyboard_is_pressed(guac_rdp_keyboard* keyboard, int keysym) {

    guac_rdp_key* key = guac_rdp_keyboard_get_key(keyboard, keysym);
    return key != NULL && key->pressed != NULL;

}

unsigned int guac_rdp_keyboard_get_modifier_flags(guac_rdp_keyboard* keyboard) {

    unsigned int modifier_flags = 0;

    /* Shift */
    if (guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_LSHIFT)
            || guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_RSHIFT))
        modifier_flags |= GUAC_RDP_KEYMAP_MODIFIER_SHIFT;

    /* Dedicated AltGr key */
    if (guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_RALT)
            || guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_ALTGR))
        modifier_flags |= GUAC_RDP_KEYMAP_MODIFIER_ALTGR;

    /* AltGr via Ctrl+Alt */
    if (guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_LALT)
            && (guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_RCTRL)
                || guac_rdp_keyboard_is_pressed(keyboard, GUAC_RDP_KEYSYM_LCTRL)))
        modifier_flags |= GUAC_RDP_KEYMAP_MODIFIER_ALTGR;

    return modifier_flags;

}

/**
 * Presses/releases the requested key by sending one or more RDP key events, as
 * defined within the keymap defining that key.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param key
 *     The guac_rdp_keysym_desc of the key being pressed or released, as
 *     retrieved from the relevant keymap.
 *
 * @param pressed
 *     Zero if the key is being released, non-zero otherwise.
 *
 * @return
 *     Zero if the key was successfully pressed/released, non-zero if the key
 *     cannot be sent using RDP key events.
 */
static const guac_rdp_keysym_desc* guac_rdp_keyboard_send_defined_key(guac_rdp_keyboard* keyboard,
        guac_rdp_key* key, int pressed) {

    guac_client* client = keyboard->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    const guac_rdp_keysym_desc* keysym_desc = guac_rdp_keyboard_get_definition(keyboard, key);
    if (keysym_desc->scancode == 0)
        return NULL;

    /* Update state of required locks and modifiers only when key is just
     * now being pressed */
    if (pressed) {
        guac_rdp_keyboard_update_locks(keyboard,
                keysym_desc->set_locks,
                keysym_desc->clear_locks);

        guac_rdp_keyboard_update_modifiers(keyboard,
                keysym_desc->set_modifiers,
                keysym_desc->clear_modifiers);
    }

    /* Fire actual key event for target key */
    guac_rdp_send_key_event(rdp_client, keysym_desc->scancode,
            keysym_desc->flags, pressed);

    return keysym_desc;

}

/**
 * Presses and releases the requested key by sending one or more RDP events,
 * without relying on a keymap for that key. This will typically involve either
 * sending the key using a Unicode event or decomposing the key into a series
 * of keypresses involving deadkeys.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param keysym
 *     The keysym of the key to press and release.
 */
static void guac_rdp_keyboard_send_missing_key(guac_rdp_keyboard* keyboard,
        int keysym) {

    guac_client* client = keyboard->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Attempt to type using dead keys */
    if (!guac_rdp_decompose_keysym(keyboard, keysym))
        return;

    guac_client_log(client, GUAC_LOG_DEBUG, "Sending keysym 0x%x as "
            "Unicode", keysym);

    /* Translate keysym into codepoint */
    int codepoint;
    if (keysym <= 0xFF)
        codepoint = keysym;
    else if (keysym >= 0x1000000)
        codepoint = keysym & 0xFFFFFF;
    else {
        guac_client_log(client, GUAC_LOG_DEBUG, "Unmapped keysym has no "
                "equivalent unicode value: 0x%x", keysym);
        return;
    }

    /* Send as Unicode event */
    guac_rdp_send_unicode_event(rdp_client, codepoint);

}

void guac_rdp_keyboard_update_locks(guac_rdp_keyboard* keyboard,
        unsigned int set_flags, unsigned int clear_flags) {

    guac_client* client = keyboard->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Calculate updated lock flags */
    unsigned int lock_flags = (keyboard->lock_flags | set_flags) & ~clear_flags;

    /* Synchronize remote side only if lock flags have changed */
    if (lock_flags != keyboard->lock_flags) {
        guac_rdp_send_synchronize_event(rdp_client, lock_flags);
        keyboard->lock_flags = lock_flags;
    }

}

void guac_rdp_keyboard_update_modifiers(guac_rdp_keyboard* keyboard,
        unsigned int set_flags, unsigned int clear_flags) {

    unsigned int modifier_flags = guac_rdp_keyboard_get_modifier_flags(keyboard);

    /* Only clear modifiers that are set */
    clear_flags &= modifier_flags;

    /* Only set modifiers that are currently cleared */
    set_flags &= ~modifier_flags;

    /* Press/release Shift as needed */
    if (set_flags & GUAC_RDP_KEYMAP_MODIFIER_SHIFT) {
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_LSHIFT, 1, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    }
    else if (clear_flags & GUAC_RDP_KEYMAP_MODIFIER_SHIFT) {
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_LSHIFT, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_RSHIFT, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    }

    /* Press/release AltGr as needed */
    if (set_flags & GUAC_RDP_KEYMAP_MODIFIER_ALTGR) {
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_ALTGR, 1, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    }
    else if (clear_flags & GUAC_RDP_KEYMAP_MODIFIER_ALTGR) {
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_ALTGR, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_LALT, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_RALT, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_LCTRL, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
        guac_rdp_keyboard_update_keysym(keyboard, GUAC_RDP_KEYSYM_RCTRL, 0, GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    }

}

int guac_rdp_keyboard_update_keysym(guac_rdp_keyboard* keyboard,
        int keysym, int pressed, guac_rdp_key_source source) {

    /* Synchronize lock keys states, if this has not yet been done */
    if (!keyboard->synchronized) {

        guac_client* client = keyboard->client;
        guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

        /* Synchronize remote lock key states with local state */
        guac_rdp_send_synchronize_event(rdp_client, keyboard->lock_flags);
        keyboard->synchronized = 1;

    }

    guac_rdp_key* key = guac_rdp_keyboard_get_key(keyboard, keysym);

    /* Update tracking of client-side keyboard state but only for keys which
     * are tracked server-side, as well (to ensure that the key count remains
     * correct, even if a user sends extra unbalanced or excessive press and
     * release events) */
    if (source == GUAC_RDP_KEY_SOURCE_CLIENT && key != NULL) {
        if (pressed && !key->user_pressed) {
            keyboard->user_pressed_keys++;
            key->user_pressed = 1;
        }
        else if (!pressed && key->user_pressed) {
            keyboard->user_pressed_keys--;
            key->user_pressed = 0;
        }
    }

    /* Send events and update server-side lock state only if server-side key
     * state is changing (or if server-side state of this key is untracked) */
    if (key == NULL || (pressed && key->pressed == NULL) || (!pressed && key->pressed != NULL)) {

        /* Toggle locks on keydown */
        if (pressed)
            keyboard->lock_flags ^= guac_rdp_keyboard_lock_flag(keysym);

        /* If key is known, update state and attempt to send using normal RDP key
         * events */
        const guac_rdp_keysym_desc* definition = NULL;
        if (key != NULL) {
            definition = guac_rdp_keyboard_send_defined_key(keyboard, key, pressed);
            key->pressed = pressed ? definition : NULL;
        }

        /* Fall back to dead keys or Unicode events if otherwise undefined inside
         * current keymap (note that we only handle "pressed" here, as neither
         * Unicode events nor dead keys can have a pressed/released state) */
        if (definition == NULL && pressed) {
            guac_rdp_keyboard_send_missing_key(keyboard, keysym);
        }

    }

    /* Reset RDP server keyboard state (releasing any automatically
     * pressed keys) once all keys have been released on the client
     * side */
    if (source == GUAC_RDP_KEY_SOURCE_CLIENT && keyboard->user_pressed_keys == 0)
        guac_rdp_keyboard_reset(keyboard);

    return 0;

}

void guac_rdp_keyboard_reset(guac_rdp_keyboard* keyboard) {

    /* Release all pressed keys */
    for (int i = 0; i < keyboard->num_keys; i++) {
        guac_rdp_key* key = &keyboard->keys[i];
        if (key->pressed != NULL)
            guac_rdp_keyboard_update_keysym(keyboard, key->pressed->keysym, 0,
                    GUAC_RDP_KEY_SOURCE_SYNTHETIC);
    }

}

BOOL guac_rdp_keyboard_set_indicators(rdpContext* context, UINT16 flags) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Skip if keyboard not yet ready */
    guac_rdp_keyboard* keyboard = rdp_client->keyboard;
    if (keyboard == NULL)
        goto complete;

    /* Update with received locks */
    guac_client_log(client, GUAC_LOG_DEBUG, "Received updated keyboard lock flags from RDP server: 0x%X", flags);
    keyboard->lock_flags = flags;

complete:
    guac_rwlock_release_lock(&(rdp_client->lock));
    return TRUE;

}
