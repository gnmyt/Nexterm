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
#include "auth.h"
#include "vnc.h"

#include <guacamole/argv.h>
#include <guacamole/client.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/string.h>
#include <rfb/rfbclient.h>
#include <rfb/rfbproto.h>

#include <pthread.h>
#include <string.h>

char* guac_vnc_get_password(rfbClient* client) {
    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = ((guac_vnc_client*) gc->data);
    guac_vnc_settings* settings = vnc_client->settings;
    
    /* If the client does not support the "required" instruction, just return
        the configuration data. */
    if (!guac_client_owner_supports_required(gc))
        return guac_strdup(settings->password);
    
    /* If password isn't around, prompt for it. */
    if (settings->password == NULL) {
        
        guac_argv_register(GUAC_VNC_ARGV_PASSWORD, guac_vnc_argv_callback, NULL, 0);
        
        const char* params[] = {GUAC_VNC_ARGV_PASSWORD, NULL};
        
        /* Send the request for password to the owner. */
        guac_client_owner_send_required(gc, params);
                
        /* Wait for the arguments to be returned */
        guac_argv_await(params);

    }
    
    return guac_strdup(settings->password);
    
}

#ifdef ENABLE_VNC_GENERIC_CREDENTIALS
rfbCredential* guac_vnc_get_credentials(rfbClient* client, int credentialType) {
    
    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = ((guac_vnc_client*) gc->data);
    guac_vnc_settings* settings = vnc_client->settings;
    
    /* Handle request for Username/Password credentials */
    if (credentialType == rfbCredentialTypeUser) {
        rfbCredential *creds = malloc(sizeof(rfbCredential));
        
        /* If the client supports the "required" instruction, prompt for and
           update those. */
        if (guac_client_owner_supports_required(gc)) {
            char* params[3] = {NULL};
            int i = 0;

            /* Check if username is not provided. */
            if (settings->username == NULL) {
                guac_argv_register(GUAC_VNC_ARGV_USERNAME, guac_vnc_argv_callback, NULL, 0);
                params[i] = GUAC_VNC_ARGV_USERNAME;
                i++;
            }

            /* Check if password is not provided. */
            if (settings->password == NULL) {
                guac_argv_register(GUAC_VNC_ARGV_PASSWORD, guac_vnc_argv_callback, NULL, 0);
                params[i] = GUAC_VNC_ARGV_PASSWORD;
                i++;
            }

            params[i] = NULL;

            /* If we have empty parameters, request them and await response. */
            if (i > 0) {
                guac_client_owner_send_required(gc, (const char**) params);
                guac_argv_await((const char**) params);
            }
        }
        
        /* Copy the values and return the credential set. */
        creds->userCredential.username = guac_strdup(settings->username);
        creds->userCredential.password = guac_strdup(settings->password);
        return creds;
        
    }

    guac_client_abort(gc, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
            "Unsupported credential type requested.");
    guac_client_log(gc, GUAC_LOG_DEBUG,
            "Unable to provide requested type of credential: %d.",
            credentialType);
    return NULL;
    
}
#endif
