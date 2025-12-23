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

#ifndef GUAC_RDP_PLUGINS_CHANNELS_H
#define GUAC_RDP_PLUGINS_CHANNELS_H

#include <freerdp/channels/channels.h>
#include <freerdp/freerdp.h>
#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <winpr/wtsapi.h>

/**
 * The maximum number of static channels supported by Guacamole's RDP support.
 * This value should be given a value which is at least the value of FreeRDP's
 * CHANNEL_MAX_COUNT.
 *
 * NOTE: The value of this macro must be specified statically (not as a
 * reference to CHANNEL_MAX_COUNT), as its value is extracted and used by the
 * entry point wrapper code generator (generate-entry-wrappers.pl).
 */
#define GUAC_RDP_MAX_CHANNELS 64

/* Validate GUAC_RDP_MAX_CHANNELS is sane at compile time */
#if GUAC_RDP_MAX_CHANNELS < CHANNEL_MAX_COUNT
#error "GUAC_RDP_MAX_CHANNELS must not be less than CHANNEL_MAX_COUNT"
#endif

/** Loads the FreeRDP plugin having the given name. With the exception that
 * this function requires the rdpContext rather than rdpChannels and
 * rdpSettings, this function is essentially a drop-in replacement for
 * freerdp_channels_load_plugin() which additionally loads plugins implementing
 * the PVIRTUALCHANNELENTRYEX version of the channel plugin entry point. The
 * freerdp_channels_load_plugin() function which is part of FreeRDP can load
 * only plugins which implement the PVIRTUALCHANNELENTRY version of the entry
 * point.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for the referenced plugin to be loaded correctly.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param name
 *     The name of the plugin to load. If the plugin is not statically built
 *     into FreeRDP, this name will determine the filename of the library to be
 *     loaded dynamically. For a plugin named "NAME", the library called
 *     "libNAME-client" will be loaded from the "freerdp2" or "freerdp3"
 *     subdirectory of the main directory containing the FreeRDP libraries.
 *
 * @param data
 *     Arbitrary data to be passed to the plugin entry point. For most plugins
 *     which are built into FreeRDP, this will be another reference to the
 *     rdpSettings struct. The source of the relevant plugin must be consulted
 *     to determine the proper value to pass here.
 *
 * @return
 *     Zero if the plugin was loaded successfully, non-zero if the plugin could
 *     not be loaded.
 */
int guac_freerdp_channels_load_plugin(rdpContext* context,
        const char* name, void* data);

/**
 * Schedules loading of the FreeRDP dynamic virtual channel plugin having the
 * given name. This function is essentially a wrapper for
 * freerdp_dynamic_channel_collection_add() which additionally takes care of
 * housekeeping tasks which would otherwise need to be performed manually:
 *
 *  - The ADDIN_ARGV structure used to pass arguments to dynamic virtual
 *    channel plugins is automatically allocated and populated with any given
 *    arguments.
 *  - The SupportDynamicChannels member of the rdpSettings structure is
 *    automatically set to TRUE.
 *
 * The "drdynvc" plugin must still eventually be loaded for this function to
 * have any effect, as it is the "drdynvc" plugin which processes the
 * collection this function manipulates.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * and the "drdynvc" plugin MUST be loaded at some point after this function is
 * called for the referenced dynamic channel plugin to be loaded correctly.
 *
 * @param settings
 *     The rdpSettings structure associated with the FreeRDP instance, already
 *     populated with any settings applicable to the plugin being loaded.
 *
 * @param name
 *     The name of the plugin to load. If the plugin is not statically built
 *     into FreeRDP, this name will determine the filename of the library to be
 *     loaded dynamically. For a plugin named "NAME", the library called
 *     "libNAME-client" will be loaded from the "freerdp2" or "freerdp3"
 *     subdirectory of the main directory containing the FreeRDP libraries.
 *
 * @param ...
 *     Arbitrary arguments to be passed to the plugin entry point. For most
 *     plugins which are built into FreeRDP, this will be another reference to
 *     the rdpSettings struct or NULL. The source of the relevant plugin must
 *     be consulted to determine the proper value(s) to pass here.
 */
void guac_freerdp_dynamic_channel_collection_add(rdpSettings* settings,
        const char* name, ...);

/**
 * The number of wrapped channel entry points currently stored within
 * guac_rdp_wrapped_entry_ex.
 */
extern int guac_rdp_wrapped_entry_ex_count;

/**
 * All currently wrapped entry points that use the PVIRTUALCHANNELENTRYEX
 * variant.
 */
extern PVIRTUALCHANNELENTRYEX guac_rdp_wrapped_entry_ex[GUAC_RDP_MAX_CHANNELS];

/**
 * Lookup table of wrapper functions for PVIRTUALCHANNELENTRYEX entry points.
 * Each function within this array is generated at compile time by the entry
 * point wrapper code generator (generate-entry-wrappers.pl) and automatically
 * invokes the corresponding wrapped entry point stored within
 * guac_rdp_wrapped_entry_ex.
 */
extern PVIRTUALCHANNELENTRYEX guac_rdp_entry_ex_wrappers[GUAC_RDP_MAX_CHANNELS];

/**
 * Wraps the provided entry point function, returning a different entry point
 * which simply invokes the original. As long as this function is not invoked
 * more than GUAC_RDP_MAX_CHANNELS times, each returned entry point will be
 * unique, even if the provided entry point is not. As FreeRDP will refuse to
 * load a plugin if its entry point is already loaded, this allows a single
 * FreeRDP plugin to be loaded multiple times.
 *
 * @param client
 *     The guac_client associated with the relevant RDP session.
 *
 * @param entry_ex
 *     The entry point function to wrap.
 *
 * @return
 *     A wrapped version of the provided entry point, or the unwrapped entry
 *     point if there is insufficient space remaining within
 *     guac_rdp_entry_ex_wrappers to wrap the entry point.
 */
PVIRTUALCHANNELENTRYEX guac_rdp_plugin_wrap_entry_ex(guac_client* client,
        PVIRTUALCHANNELENTRYEX entry_ex);

/**
 * The number of wrapped channel entry points currently stored within
 * guac_rdp_wrapped_entry.
 */
extern int guac_rdp_wrapped_entry_count;

/**
 * All currently wrapped entry points that use the PVIRTUALCHANNELENTRY
 * variant.
 */
extern PVIRTUALCHANNELENTRY guac_rdp_wrapped_entry[GUAC_RDP_MAX_CHANNELS];

/**
 * Lookup table of wrapper functions for PVIRTUALCHANNELENTRY entry points.
 * Each function within this array is generated at compile time by the entry
 * point wrapper code generator (generate-entry-wrappers.pl) and automatically
 * invokes the corresponding wrapped entry point stored within
 * guac_rdp_wrapped_entry.
 */
extern PVIRTUALCHANNELENTRY guac_rdp_entry_wrappers[GUAC_RDP_MAX_CHANNELS];

/**
 * Wraps the provided entry point function, returning a different entry point
 * which simply invokes the original. As long as this function is not invoked
 * more than GUAC_RDP_MAX_CHANNELS times, each returned entry point will be
 * unique, even if the provided entry point is not. As FreeRDP will refuse to
 * load a plugin if its entry point is already loaded, this allows a single
 * FreeRDP plugin to be loaded multiple times.
 *
 * @param client
 *     The guac_client associated with the relevant RDP session.
 *
 * @param entry
 *     The entry point function to wrap.
 *
 * @return
 *     A wrapped version of the provided entry point, or the unwrapped entry
 *     point if there is insufficient space remaining within
 *     guac_rdp_entry_wrappers to wrap the entry point.
 */
PVIRTUALCHANNELENTRY guac_rdp_plugin_wrap_entry(guac_client* client,
        PVIRTUALCHANNELENTRY entry);

#endif
