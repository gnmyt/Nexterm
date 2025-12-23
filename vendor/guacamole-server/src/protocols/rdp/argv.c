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
#include "argv.h"
#include "rdp.h"
#include "settings.h"

#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/string.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <stdlib.h>
#include <string.h>

int guac_rdp_argv_callback(guac_user* user, const char* mimetype,
        const char* name, const char* value, void* data) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* Update username */
    if (strcmp(name, GUAC_RDP_ARGV_USERNAME) == 0) {
        guac_mem_free(settings->username);
        settings->username = guac_strdup(value);
    }
    
    /* Update password */
    else if (strcmp(name, GUAC_RDP_ARGV_PASSWORD) == 0) {
        guac_mem_free(settings->password);
        settings->password = guac_strdup(value);
    }
    
    /* Update domain */
    else if (strcmp(name, GUAC_RDP_ARGV_DOMAIN) == 0) {
        guac_mem_free(settings->domain);
        settings->domain = guac_strdup(value);
    }

    return 0;

}
