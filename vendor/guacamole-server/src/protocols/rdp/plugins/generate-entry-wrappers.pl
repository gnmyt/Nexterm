#!/usr/bin/env perl
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

#
# generate-entry-wrappers.pl
#
# Generates C source which defines wrapper functions for FreeRDP plugin entry
# points, allowing multiple instances of the same plugin to be loaded despite
# otherwise always having the same entry point.
#
# The resulting source is stored within "_generated_channel_entry_wrappers.c".
#

use strict;

##
## The maximum number of static channels supported by Guacamole's RDP support.
##
my $GUAC_RDP_MAX_CHANNELS;

# Extract value of GUAC_RDP_MAX_CHANNELS macro from provided source
while (<>) {
    if ((my $value) = m/^\s*#define\s+GUAC_RDP_MAX_CHANNELS\s+(\d+)\s*$/) {
        $GUAC_RDP_MAX_CHANNELS = $value;
    }
}

open OUTPUT, ">", "_generated_channel_entry_wrappers.c";

# Generate required headers
print OUTPUT <<"EOF";
#include "plugins/channels.h"
#include <freerdp/channels/channels.h>
#include <freerdp/freerdp.h>
EOF

# Generate wrapper definitions for PVIRTUALCHANNELENTRYEX entry point variant
print OUTPUT <<"EOF" for (1..$GUAC_RDP_MAX_CHANNELS);
static BOOL guac_rdp_plugin_entry_ex_wrapper$_(PCHANNEL_ENTRY_POINTS_EX entry_points_ex, PVOID init_handle) {
    return guac_rdp_wrapped_entry_ex[$_ - 1](entry_points_ex, init_handle);
}
EOF

# Generate wrapper definitions for PVIRTUALCHANNELENTRY entry point variant
print OUTPUT <<"EOF" for (1..$GUAC_RDP_MAX_CHANNELS);
static BOOL guac_rdp_plugin_entry_wrapper$_(PCHANNEL_ENTRY_POINTS entry_points) {
    return guac_rdp_wrapped_entry[$_ - 1](entry_points);
}
EOF

# Populate lookup table of PVIRTUALCHANNELENTRYEX wrapper functions
print OUTPUT "PVIRTUALCHANNELENTRYEX guac_rdp_entry_ex_wrappers[$GUAC_RDP_MAX_CHANNELS] = {\n";
print OUTPUT "    guac_rdp_plugin_entry_ex_wrapper$_,\n" for (1..$GUAC_RDP_MAX_CHANNELS);
print OUTPUT "};\n";

# Populate lookup table of PVIRTUALCHANNELENTRY wrapper functions
print OUTPUT "PVIRTUALCHANNELENTRY guac_rdp_entry_wrappers[$GUAC_RDP_MAX_CHANNELS] = {\n";
print OUTPUT "    guac_rdp_plugin_entry_wrapper$_,\n" for (1..$GUAC_RDP_MAX_CHANNELS);
print OUTPUT "};\n";

