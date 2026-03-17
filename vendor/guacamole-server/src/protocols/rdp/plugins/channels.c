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

#include "plugins/channels.h"
#include "rdp.h"

#include <freerdp/channels/channels.h>
#include <freerdp/freerdp.h>
#include <freerdp/addin.h>
#include <guacamole/mem.h>
#include <winpr/wtypes.h>

#include <stdarg.h>
#include <stdlib.h>
#include <string.h>

int guac_rdp_wrapped_entry_ex_count = 0;

int guac_rdp_wrapped_entry_count = 0;

PVIRTUALCHANNELENTRYEX guac_rdp_wrapped_entry_ex[GUAC_RDP_MAX_CHANNELS] = { NULL };

PVIRTUALCHANNELENTRY guac_rdp_wrapped_entry[GUAC_RDP_MAX_CHANNELS] = { NULL };

PVIRTUALCHANNELENTRYEX guac_rdp_plugin_wrap_entry_ex(guac_client* client,
        PVIRTUALCHANNELENTRYEX entry_ex) {

    /* Do not wrap if there is insufficient space to store the wrapped
     * function */
    if (guac_rdp_wrapped_entry_ex_count == GUAC_RDP_MAX_CHANNELS) {
        guac_client_log(client, GUAC_LOG_WARNING, "Maximum number of static "
                "channels has been reached. Further FreeRDP plugins and "
                "channel support may fail to load.");
        return entry_ex;
    }

    /* Generate wrapped version of provided entry point */
    PVIRTUALCHANNELENTRYEX wrapper = guac_rdp_entry_ex_wrappers[guac_rdp_wrapped_entry_ex_count];
    guac_rdp_wrapped_entry_ex[guac_rdp_wrapped_entry_ex_count] = entry_ex;
    guac_rdp_wrapped_entry_ex_count++;

    return wrapper;

}

PVIRTUALCHANNELENTRY guac_rdp_plugin_wrap_entry(guac_client* client,
        PVIRTUALCHANNELENTRY entry) {

    /* Do not wrap if there is insufficient space to store the wrapped
     * function */
    if (guac_rdp_wrapped_entry_count == GUAC_RDP_MAX_CHANNELS) {
        guac_client_log(client, GUAC_LOG_WARNING, "Maximum number of static "
                "channels has been reached. Further FreeRDP plugins and "
                "channel support may fail to load.");
        return entry;
    }

    /* Generate wrapped version of provided entry point */
    PVIRTUALCHANNELENTRY wrapper = guac_rdp_entry_wrappers[guac_rdp_wrapped_entry_count];
    guac_rdp_wrapped_entry[guac_rdp_wrapped_entry_count] = entry;
    guac_rdp_wrapped_entry_count++;

    return wrapper;

}

int guac_freerdp_channels_load_plugin(rdpContext* context,
        const char* name, void* data) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    /* Load plugin using "ex" version of the channel plugin entry point, if it exists */
    PVIRTUALCHANNELENTRYEX entry_ex = (PVIRTUALCHANNELENTRYEX) (void*) freerdp_load_channel_addin_entry(name,
            NULL, NULL, FREERDP_ADDIN_CHANNEL_STATIC | FREERDP_ADDIN_CHANNEL_ENTRYEX);

    if (entry_ex != NULL) {
        entry_ex = guac_rdp_plugin_wrap_entry_ex(client, entry_ex);
        return freerdp_channels_client_load_ex(context->channels, context->settings, entry_ex, data);
    }

    /* Lacking the "ex" entry point, attempt to load using the non-ex version */
    PVIRTUALCHANNELENTRY entry = freerdp_load_channel_addin_entry(name,
            NULL, NULL, FREERDP_ADDIN_CHANNEL_STATIC);

    if (entry != NULL) {
        entry = guac_rdp_plugin_wrap_entry(client, entry);
        return freerdp_channels_client_load(context->channels, context->settings, entry, data);
    }

    /* The plugin does not exist / cannot be loaded */
    return 1;

}

void guac_freerdp_dynamic_channel_collection_add(rdpSettings* settings,
        const char* name, ...) {

    va_list args;

    ADDIN_ARGV* freerdp_args = malloc(sizeof(ADDIN_ARGV));

    va_start(args, name);

    /* Count number of arguments (excluding terminating NULL) */
    freerdp_args->argc = 1;
    while (va_arg(args, char*) != NULL)
        freerdp_args->argc++;

    /* Reset va_list */
    va_end(args);
    va_start(args, name);

    /* Copy argument values into DVC entry */
    freerdp_args->argv = malloc(guac_mem_ckd_mul_or_die(sizeof(char*), freerdp_args->argc));
    freerdp_args->argv[0] = strdup(name);
    int i;
    for (i = 1; i < freerdp_args->argc; i++)
        freerdp_args->argv[i] = strdup(va_arg(args, char*));

    va_end(args);

    /* Register plugin with FreeRDP */
#ifdef HAVE_SETTERS_GETTERS
    freerdp_settings_set_bool(settings, FreeRDP_SupportDynamicChannels, TRUE);
#else
    settings->SupportDynamicChannels = TRUE;
#endif

    freerdp_dynamic_channel_collection_add(settings, freerdp_args);
}
