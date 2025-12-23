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

#ifndef GUAC_RDP_CHANNELS_RDPDR_MESSAGES_H
#define GUAC_RDP_CHANNELS_RDPDR_MESSAGES_H

#include "channels/common-svc.h"
#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

#include <stdint.h>

/**
 * A 32-bit arbitrary value for the osType field of certain requests. As this
 * value is defined as completely arbitrary and required to be ignored by the
 * server, we send "GUAC" as an integer.
 */
#define GUAC_OS_TYPE (*((uint32_t*) "GUAC"))

/**
 * Handler which processes a message specific to the RDPDR channel.
 *
 * @param svc
 *     The guac_rdp_common_svc representing the static virtual channel being
 *     used for RDPDR.
 *
 * @param input_stream
 *     A wStream containing the entire received message.
 */
typedef void guac_rdpdr_message_handler(guac_rdp_common_svc* svc,
        wStream* input_stream);

/**
 * Handler which processes a received Server Announce Request message. The
 * Server Announce Request message begins the RDPDR exchange and provides a
 * client ID which the RDPDR client may use. The client may also supply its
 * own, randomly-generated ID, and is required to do so for older versions of
 * RDPDR. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/046047aa-62d8-49f9-bf16-7fe41880aaf4
 */
guac_rdpdr_message_handler guac_rdpdr_process_server_announce;

/**
 * Handler which processes a received Server Client ID Confirm message. The
 * Server Client ID Confirm message is sent by the server to confirm the client
 * ID requested by the client (in its response to the Server Announce Request)
 * has been accepted. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/bbbb9666-6994-4cf6-8e65-0d46eb319c6e
 */
guac_rdpdr_message_handler guac_rdpdr_process_clientid_confirm;

/**
 * Handler which processes a received Server Device Announce Response message.
 * The Server Device Announce Response message is sent in response to a Client
 * Device List Announce message to communicate the success/failure status of
 * device creation. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/a4c0b619-6e87-4721-bdc4-5d2db7f485f3
 */
guac_rdpdr_message_handler guac_rdpdr_process_device_reply;

/**
 * Handler which processes a received Device I/O Request message. The Device
 * I/O Request message makes up the majority of traffic once RDPDR is
 * established. Each I/O request consists of a device-specific major/minor
 * function number pair, as well as several parameters. Device-specific
 * handling of I/O requests within Guacamole is delegated to device- and
 * function-specific implementations of yet another function type:
 * guac_rdpdr_device_iorequest_handler.
 *
 * See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/a087ffa8-d0d5-4874-ac7b-0494f63e2d5d
 */
guac_rdpdr_message_handler guac_rdpdr_process_device_iorequest;

/**
 * Handler which processes a received Server Core Capability Request message.
 * The Server Core Capability Request message is sent by the server to
 * communicate its capabilities and to request that the client communicate the
 * same. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/702789c3-b924-4bc2-9280-3221bc7d6797
 */
guac_rdpdr_message_handler guac_rdpdr_process_server_capability;

/**
 * Handler which processes a received Server User Logged On message. The Server
 * User Logged On message is sent by the server to notify that the user has
 * logged on to the session. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/dfc0e8ed-a242-4d00-bb88-e779e08f2f61
 */
guac_rdpdr_message_handler guac_rdpdr_process_user_loggedon;

/**
 * Handler which processes any one of several RDPDR messages specific to cached
 * printer configuration data, each of these messages having the same
 * PAKID_PRN_CACHE_DATA packet ID. The Guacamole RDPDR implementation ignores
 * all PAKID_PRN_CACHE_DATA messages. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpepc/7fccae60-f077-433b-9dee-9bad4238bf40
 */
guac_rdpdr_message_handler guac_rdpdr_process_prn_cache_data;

/**
 * Handler which processes a received Server Printer Set XPS Mode message. The
 * Server Printer Set XPS Mode message is specific to printers and requests
 * that the client printer be set to XPS mode. The Guacamole RDPDR
 * implementation ignores any request to set the printer to XPS mode. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpepc/f1789a66-bcd0-4df3-bfc2-6e7330d63145
 */
guac_rdpdr_message_handler guac_rdpdr_process_prn_using_xps;

#endif

