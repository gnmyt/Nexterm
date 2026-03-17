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
#include "display.h"
#include "layer.h"
#include "log.h"
#include "video.h"

#include <guacamole/client.h>
#include <guacamole/timestamp.h>

#include <assert.h>
#include <stdlib.h>

int guacenc_display_sync(guacenc_display* display, guac_timestamp timestamp) {

    /* Verify timestamp is not decreasing */
    if (timestamp < display->last_sync) {
        guacenc_log(GUAC_LOG_WARNING, "Decreasing sync timestamp");
        return 1;
    }

    /* Update timestamp of display */
    display->last_sync = timestamp;

    /* Flatten display to default layer */
    if (guacenc_display_flatten(display))
        return 1;

    /* Retrieve default layer (guaranteed to not be NULL) */
    guacenc_layer* def_layer = guacenc_display_get_layer(display, 0);
    assert(def_layer != NULL);

    /* Update video timeline */
    if (guacenc_video_advance_timeline(display->output, timestamp))
        return 1;

    /* Prepare frame for write upon next flush */
    guacenc_video_prepare_frame(display->output, def_layer->frame);
    return 0;

}

