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

#ifndef GUAC_RDP_KEYBOARD_H
#define GUAC_RDP_KEYBOARD_H

#include "keymap.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>

/**
 * The maximum number of distinct keysyms that any particular keyboard may support.
 */
#define GUAC_RDP_KEYBOARD_MAX_KEYSYMS 1024

/**
 * The maximum number of unique modifier variations that any particular keysym
 * may define. For example, on a US English keyboard, an uppercase "A" may be
 * typed by pressing Shift+A with Caps Lock unset, or by pressing A with Caps
 * Lock set (two variations).
 */
#define GUAC_RDP_KEY_MAX_DEFINITIONS 4

/**
 * All possible sources of RDP key events tracked by guac_rdp_keyboard.
 */
typedef enum guac_rdp_key_source {

    /**
     * The key event was received directly from the Guacamole client via a
     * "key" instruction.
     */
    GUAC_RDP_KEY_SOURCE_CLIENT = 0,

    /**
     * The key event is being synthesized internally within the RDP support.
     */
    GUAC_RDP_KEY_SOURCE_SYNTHETIC = 1

} guac_rdp_key_source;

/**
 * A representation of a single key within the overall local keyboard,
 * including the definition of that key within the RDP server's keymap and
 * whether the key is currently pressed locally.
 */
typedef struct guac_rdp_key {

    /**
     * All definitions of this key within the RDP server's keymap (keyboard
     * layout). Each definition describes which scancode corresponds to this
     * key from the perspective of the RDP server, as well as which other
     * scancodes must be pressed/released for this key to have the desired
     * meaning.
     */
    const guac_rdp_keysym_desc* definitions[GUAC_RDP_KEY_MAX_DEFINITIONS];

    /**
     * The number of definitions within the definitions array. If this key does
     * not exist within the RDP server's keymap, this will be 0.
     */
    int num_definitions;

    /**
     * The definition of this key that is currently pressed. If this key is not
     * currently pressed, this will be NULL.
     */
    const guac_rdp_keysym_desc* pressed;

    /**
     * Whether this key is currently pressed by the user, and is included among
     * the total tracked by user_pressed_keys within guac_rdp_keyboard.
     */
    int user_pressed;

} guac_rdp_key;

/**
 * The current keyboard state of an RDP session.
 */
typedef struct guac_rdp_keyboard {

    /**
     * The guac_client associated with the RDP session whose keyboard state is
     * being managed by this guac_rdp_keyboard.
     */
    guac_client* client;

    /**
     * The local state of all known lock keys, as a bitwise OR of all RDP lock
     * key flags. Legal flags are KBD_SYNC_SCROLL_LOCK, KBD_SYNC_NUM_LOCK,
     * KBD_SYNC_CAPS_LOCK, and KBD_SYNC_KANA_LOCK.
     */
    UINT32 lock_flags;

    /**
     * Whether the states of remote lock keys (Caps lock, Num lock, etc.) have
     * been synchronized with local lock key states.
     */
    int synchronized;

    /**
     * The number of keys stored within the keys array.
     */
    unsigned int num_keys;

    /**
     * The local state of all keys, as well as the necessary information to
     * translate received keysyms into scancodes or sequences of scancodes for
     * RDP. The state of each key is updated based on received Guacamole key
     * events, while the information describing the behavior and scancode
     * mapping of each key is populated based on an associated keymap.
     *
     * Keys within this array are in arbitrary order.
     */
    guac_rdp_key keys[GUAC_RDP_KEYBOARD_MAX_KEYSYMS];

    /**
     * Lookup table into the overall keys array, locating the guac_rdp_key
     * associated with any particular keysym. If a keysym has no corresponding
     * guac_rdp_key within the keys array, its entry within this lookuptable
     * will be NULL.
     *
     * The index of the key for a given keysym is determined based on a
     * simple transformation of the keysym itself. Keysyms between 0x0000 and
     * 0xFFFF inclusive are mapped to 0x00000 through 0x0FFFF, while keysyms
     * between 0x1000000 and 0x100FFFF inclusive (keysyms which are derived
     * from Unicode) are mapped to 0x10000 through 0x1FFFF.
     */
    guac_rdp_key* keys_by_keysym[0x20000];

    /**
     * The total number of keys that the user of the connection is currently
     * holding down. This value indicates only the client-side keyboard state.
     * It DOES NOT indicate the number of keys currently pressed within the RDP
     * server.
     */
    int user_pressed_keys;

} guac_rdp_keyboard;

/**
 * Allocates a new guac_rdp_keyboard which manages the keyboard state of the
 * RDP session associated with the given guac_client. Keyboard events will be
 * dynamically translated from keysym to RDP scancode according to the provided
 * keymap. The returned guac_rdp_keyboard must eventually be freed with
 * guac_rdp_keyboard_free().
 *
 * @param client
 *     The guac_client associated with the RDP session whose keyboard state is
 *     to be managed by the newly-allocated guac_rdp_keyboard.
 *
 * @param keymap
 *     The keymap which should be used to translate keyboard events.
 *
 * @return
 *     A newly-allocated guac_rdp_keyboard which manages the keyboard state
 *     for the RDP session associated given guac_client.
 */
guac_rdp_keyboard* guac_rdp_keyboard_alloc(guac_client* client,
        const guac_rdp_keymap* keymap);

/**
 * Frees all memory allocated for the given guac_rdp_keyboard. The
 * guac_rdp_keyboard must have been previously allocated via
 * guac_rdp_keyboard_alloc().
 *
 * @param keyboard
 *     The guac_rdp_keyboard instance which should be freed.
 */
void guac_rdp_keyboard_free(guac_rdp_keyboard* keyboard);

/**
 * Returns whether the given keysym is defined for the keyboard layout
 * associated with the given keyboard.
 *
 * @param keyboard
 *     The guac_rdp_keyboard instance to check.
 *
 * @param keysym
 *     The keysym of the key being checked against the keyboard layout of the
 *     given keyboard.
 *
 * @return
 *     Non-zero if the key is explicitly defined within the keyboard layout of
 *     the given keyboard, zero otherwise.
 */
int guac_rdp_keyboard_is_defined(guac_rdp_keyboard* keyboard, int keysym);

/**
 * Returns whether the key having the given keysym is currently pressed.
 *
 * @param keyboard
 *     The guac_rdp_keyboard instance to check.
 *
 * @param keysym
 *     The keysym of the key being checked.
 *
 * @return
 *     Non-zero if the key is currently pressed, zero otherwise.
 */
int guac_rdp_keyboard_is_pressed(guac_rdp_keyboard* keyboard, int keysym);

/**
 * Returns the local state of all known modifier keys, as a bitwise OR of the
 * modifier flags used by the keymaps. Alternative methods of producing the
 * effect of certain modifiers, such as holding Ctrl+Alt for AltGr when a
 * dedicated AltGr key is unavailable, are taken into account.
 *
 * @see GUAC_RDP_KEYMAP_MODIFIER_SHIFT
 * @see GUAC_RDP_KEYMAP_MODIFIER_ALTGR
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @return
 *     The local state of all known modifier keys.
 */
unsigned int guac_rdp_keyboard_get_modifier_flags(guac_rdp_keyboard* keyboard);

/**
 * Updates the local state of the lock keys (such as Caps lock or Num lock),
 * synchronizing the remote state of those keys if it is expected to differ.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param set_flags
 *     The lock key flags which should be set. Legal flags are
 *     KBD_SYNC_SCROLL_LOCK, KBD_SYNC_NUM_LOCK, KBD_SYNC_CAPS_LOCK, and
 *     KBD_SYNC_KANA_LOCK.
 *
 * @param clear_flags
 *     The lock key flags which should be cleared. Legal flags are
 *     KBD_SYNC_SCROLL_LOCK, KBD_SYNC_NUM_LOCK, KBD_SYNC_CAPS_LOCK, and
 *     KBD_SYNC_KANA_LOCK.
 */
void guac_rdp_keyboard_update_locks(guac_rdp_keyboard* keyboard,
        unsigned int set_flags, unsigned int clear_flags);

/**
 * Updates the local state of the modifier keys (such as Shift or AltGr),
 * synchronizing the remote state of those keys if it is expected to differ.
 * Valid modifier flags are defined by keymap.h.
 *
 * @see GUAC_RDP_KEYMAP_MODIFIER_SHIFT
 * @see GUAC_RDP_KEYMAP_MODIFIER_ALTGR
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param set_flags
 *     The modifier key flags which should be set.
 *
 * @param clear_flags
 *     The modifier key flags which should be cleared.
 */
void guac_rdp_keyboard_update_modifiers(guac_rdp_keyboard* keyboard,
        unsigned int set_flags, unsigned int clear_flags);

/**
 * Updates the local state of the given keysym, sending the key events required
 * to replicate that state remotely (on the RDP server). The key events sent
 * will depend on the current keymap.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param keysym
 *     The keysym being pressed or released.
 *
 * @param pressed
 *     Zero if the keysym is being released, non-zero otherwise.
 *
 * @param source
 *     The source of the key event represented by this call to
 *     guac_rdp_keyboard_update_keysym().
 *
 * @return
 *     Zero if the keys were successfully sent, non-zero otherwise.
 */
int guac_rdp_keyboard_update_keysym(guac_rdp_keyboard* keyboard,
        int keysym, int pressed, guac_rdp_key_source source);

/**
 * Releases all currently pressed keys, sending key release events to the RDP
 * server as necessary. Lock states (Caps Lock, etc.) are not affected.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 */
void guac_rdp_keyboard_reset(guac_rdp_keyboard* keyboard);

/**
 * Callback which is invoked by FreeRDP when the RDP server reports changes to
 * keyboard lock status using a Server Set Keyboard Indicators PDU.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param flags
 *     The remote state of all lock keys, as a bitwise OR of all RDP lock key
 *     flags. Legal flags are KBD_SYNC_SCROLL_LOCK, KBD_SYNC_NUM_LOCK,
 *     KBD_SYNC_CAPS_LOCK, and KBD_SYNC_KANA_LOCK.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_keyboard_set_indicators(rdpContext* context, UINT16 flags);

#endif

