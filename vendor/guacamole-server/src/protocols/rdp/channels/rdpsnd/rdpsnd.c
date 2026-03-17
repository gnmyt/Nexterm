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

#include "channels/common-svc.h"
#include "channels/rdpsnd/rdpsnd.h"
#include "channels/rdpsnd/rdpsnd-messages.h"
#include "rdp.h"

#include <freerdp/codec/audio.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/stream.h>

#include <stdlib.h>

void guac_rdpsnd_process_receive(guac_rdp_common_svc* svc,
        wStream* input_stream) {

    guac_rdpsnd* rdpsnd = (guac_rdpsnd*) svc->data;
    guac_rdpsnd_pdu_header header;

    /* Check that we have at least the 4 byte header (UINT8 + UINT8 + UINT16) */
    if (Stream_GetRemainingLength(input_stream) < 4) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Audio Stream does not "
                "contain the expected number of bytes. Audio redirection may "
                "not work as expected.");
        return;
    }
    
    /* Read RDPSND PDU header */
    Stream_Read_UINT8(input_stream, header.message_type);
    Stream_Seek_UINT8(input_stream);
    Stream_Read_UINT16(input_stream, header.body_size);
    
    /* 
     * If next PDU is SNDWAVE (due to receiving WaveInfo PDU previously),
     * ignore the header and parse as a Wave PDU.
     */
    if (rdpsnd->next_pdu_is_wave) {
        guac_rdpsnd_wave_handler(svc, input_stream, &header);
        return;
    }

    /* Dispatch message to standard handlers */
    switch (header.message_type) {

        /* Server Audio Formats and Version PDU */
        case SNDC_FORMATS:
            guac_rdpsnd_formats_handler(svc, input_stream, &header);
            break;

        /* Training PDU */
        case SNDC_TRAINING:
            guac_rdpsnd_training_handler(svc, input_stream, &header);
            break;

        /* WaveInfo PDU */
        case SNDC_WAVE:
            guac_rdpsnd_wave_info_handler(svc, input_stream, &header);
            break;

        /* Close PDU */
        case SNDC_CLOSE:
            guac_rdpsnd_close_handler(svc, input_stream, &header);
            break;

    }

}

void guac_rdpsnd_process_connect(guac_rdp_common_svc* svc) {

    guac_rdpsnd* rdpsnd = (guac_rdpsnd*) guac_mem_zalloc(sizeof(guac_rdpsnd));
    svc->data = rdpsnd;

}

void guac_rdpsnd_process_terminate(guac_rdp_common_svc* svc) {
    guac_mem_free(svc->data);
}

void guac_rdpsnd_load_plugin(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    /* Load support for RDPSND */
    if (guac_rdp_common_svc_load_plugin(context, "rdpsnd", 0,
                guac_rdpsnd_process_connect, guac_rdpsnd_process_receive,
                guac_rdpsnd_process_terminate)) {
        guac_client_log(client, GUAC_LOG_WARNING, "Support for the RDPSND "
                "channel (audio output) could not be loaded. Sound will not "
                "work. Drive redirection and printing MAY not work.");
    }

}

