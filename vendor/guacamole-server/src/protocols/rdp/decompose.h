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

#ifndef GUAC_RDP_DECOMPOSE_H
#define GUAC_RDP_DECOMPOSE_H

#include "config.h"
#include "keyboard.h"

/**
 * Attempts to type the given keysym by decomposing the associated character
 * into the dead key and base key pair which would be used to type that
 * character on a keyboard which lacks the necessary dedicated key. The key
 * events for the dead key and base key are sent only if the keyboard layout of
 * the given keyboard defines those keys.
 *
 * For example, the keysym for "ò" (0x00F2) would decompose into a dead grave
 * (`) and the base key "o". May it rest in peace.
 *
 * @param keyboard
 *     The guac_rdp_keyboard associated with the current RDP session.
 *
 * @param keysym
 *     The keysym being pressed.
 *
 * @return
 *     Zero if the keysym was successfully decomposed and sent to the RDP
 *     server as a pair of key events (the dead key and base key), non-zero
 *     otherwise.
 */
int guac_rdp_decompose_keysym(guac_rdp_keyboard* keyboard, int keysym);

#endif

