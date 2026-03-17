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
#include "state.h"

#include <guacamole/mem.h>
#include <guacamole/string.h>

#include <errno.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

guaclog_state* guaclog_state_alloc(const char* path) {

    /* Open output file */
    int fd = open(path, O_CREAT | O_EXCL | O_WRONLY, S_IRUSR | S_IWUSR);
    if (fd == -1) {
        guaclog_log(GUAC_LOG_ERROR, "Failed to open output file \"%s\": %s",
                path, strerror(errno));
        goto fail_output_fd;
    }

    /* Create stream for output file */
    FILE* output = fdopen(fd, "wb");
    if (output == NULL) {
        guaclog_log(GUAC_LOG_ERROR, "Failed to allocate stream for output "
                "file \"%s\": %s", path, strerror(errno));
        goto fail_output_file;
    }

    /* Allocate state */
    guaclog_state* state = (guaclog_state*) guac_mem_zalloc(sizeof(guaclog_state));
    if (state == NULL) {
        goto fail_state;
    }

    /* Associate state with output file */
    state->output = output;

    /* No keys are initially tracked */
    state->active_keys = 0;

    return state;

    /* Free all allocated data in case of failure */
fail_state:
    fclose(output);

fail_output_file:
    close(fd);

fail_output_fd:
    return NULL;

}

int guaclog_state_free(guaclog_state* state) {

    int i;

    /* Ignore NULL state */
    if (state == NULL)
        return 0;

    /* Free keydefs of all tracked keys */
    for (i = 0; i < state->active_keys; i++)
        guaclog_keydef_free(state->key_states[i].keydef);

    /* Close output file */
    fclose(state->output);

    guac_mem_free(state);
    return 0;

}

/**
 * Adds the given key state to the array of tracked keys. If the key is already
 * being tracked, its corresponding entry within the array of tracked keys is
 * updated, and the number of tracked keys remains the same. If the key is not
 * already being tracked, it is added to the end of the array of tracked keys
 * providing there is space available, and the number of tracked keys is
 * updated. Failures to add keys will be automatically logged.
 *
 * @param state
 *     The Guacamole input log interpreter state being updated.
 *
 * @param keydef
 *     The guaclog_keydef of the key being pressed or released. This
 *     guaclog_keydef will automatically be freed along with the guaclog_state
 *     if the key state was successfully added, and must be manually freed
 *     otherwise.
 *
 * @param pressed
 *     true if the key is being pressed, false if the key is being released.
 *
 * @return
 *     Zero if the key state was successfully added, non-zero otherwise.
 */
static int guaclog_state_add_key(guaclog_state* state, guaclog_keydef* keydef,
        bool pressed) {

    int i;

    /* Update existing key, if already tracked */
    for (i = 0; i < state->active_keys; i++) {
        guaclog_key_state* key = &state->key_states[i];
        if (key->keydef->keysym == keydef->keysym) {
            guaclog_keydef_free(key->keydef);
            key->keydef = keydef;
            key->pressed = pressed;
            return 0;
        }
    }

    /* If not already tracked, we need space to add it */
    if (state->active_keys == GUACLOG_MAX_KEYS) {
        guaclog_log(GUAC_LOG_WARNING, "Unable to log key 0x%X: Too many "
                "active keys.", keydef->keysym);
        return 1;
    }

    /* Add key to state */
    guaclog_key_state* key = &state->key_states[state->active_keys++];
    key->keydef = keydef;
    key->pressed = pressed;
    return 0;

}

/**
 * Removes released keys from the end of the array of tracked keys, such that
 * the last key in the array is a pressed key. This function should be invoked
 * after changes have been made to the interpreter state, to ensure that the
 * array of tracked keys does not grow longer than necessary.
 *
 * @param state
 *     The Guacamole input log interpreter state to trim.
 */
static void guaclog_state_trim_keys(guaclog_state* state) {

    int i;

    /* Reset active_keys to contain only up to the last pressed key */
    for (i = state->active_keys - 1; i >= 0; i--) {

        guaclog_key_state* key = &state->key_states[i];
        if (key->pressed) {
            state->active_keys = i + 1;
            return;
        }

        /* Free all trimmed states */
        guaclog_keydef_free(key->keydef);

    }

    /* No keys are active */
    state->active_keys = 0;

}

/**
 * Returns whether the current tracked key state represents an in-progress
 * keyboard shortcut.
 *
 * @param state
 *     The Guacamole input log interpreter state to test.
 *
 * @return
 *     true if the given state represents an in-progress keyboard shortcut,
 *     false otherwise.
 */
static bool guaclog_state_is_shortcut(guaclog_state* state) {

    int i;

    /* We are in a shortcut if at least one key is non-printable */
    for (i = 0; i < state->active_keys; i++) {
        guaclog_key_state* key = &state->key_states[i];
        if (key->keydef->value == NULL)
            return true;
    }

    /* All keys are printable - no shortcut */
    return false;

}

int guaclog_state_update_key(guaclog_state* state, int keysym, bool pressed) {

    int i;

    /* Determine nature of key */
    guaclog_keydef* keydef = guaclog_keydef_alloc(keysym);
    if (keydef == NULL)
        return 0;

    /* Update tracked key state for modifiers */
    if (keydef->modifier) {

        /* Keydef will be automatically freed if successfully added to state */
        if (guaclog_state_add_key(state, keydef, pressed))
            guaclog_keydef_free(keydef);
        else
            guaclog_state_trim_keys(state);

        return 0;

    }

    /* Output key states only for printable keys */
    if (pressed) {

        if (guaclog_state_is_shortcut(state)) {

            fprintf(state->output, "<");

            /* Compose log entry by inspecting the state of each tracked key */
            for (i = 0; i < state->active_keys; i++) {

                /* Translate keysym into human-readable name */
                guaclog_key_state* key = &state->key_states[i];

                /* Print name of key */
                if (i == 0)
                    fprintf(state->output, "%s", key->keydef->name);
                else
                    fprintf(state->output, "+%s", key->keydef->name);

            }

            fprintf(state->output, "%s>", keydef->value);

        }

        /* Print the key itself */
        else {
            if (keydef->value != NULL)
                fprintf(state->output, "%s", keydef->value);
            else
                fprintf(state->output, "<%s>", keydef->name);
        }

    }

    guaclog_keydef_free(keydef);
    return 0;

}

