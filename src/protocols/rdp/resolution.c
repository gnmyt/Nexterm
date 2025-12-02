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

#include "client.h"
#include "resolution.h"

#include <guacamole/user.h>

int guac_rdp_resolution_reasonable(guac_user* user, int resolution) {

    int width  = user->info.optimal_width;
    int height = user->info.optimal_height;

    /* Convert user pixels to remote pixels */
    width  = width  * resolution / user->info.optimal_resolution;
    height = height * resolution / user->info.optimal_resolution;

    /*
     * Resolution is reasonable if the same as the user optimal resolution
     * OR if the resulting display area is reasonable
     */
    return user->info.optimal_resolution == resolution
        || width*height >= GUAC_RDP_REASONABLE_AREA;

}

int guac_rdp_suggest_resolution(guac_user* user) {

    /* Prefer RDP's native resolution */
    if (guac_rdp_resolution_reasonable(user, GUAC_RDP_NATIVE_RESOLUTION))
        return GUAC_RDP_NATIVE_RESOLUTION;

    /* If native resolution is too tiny, try higher resolution */
    if (guac_rdp_resolution_reasonable(user, GUAC_RDP_HIGH_RESOLUTION))
        return GUAC_RDP_HIGH_RESOLUTION;

    /* Fallback to user-suggested resolution */
    return user->info.optimal_resolution;

}

