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

#ifndef GUAC_RDP_CHANNELS_RDPDR_H
#define GUAC_RDP_CHANNELS_RDPDR_H

#include "channels/common-svc.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <winpr/stream.h>

#include <stdint.h>

/**
 * The maximum number of bytes to allow for a device read.
 */
#define GUAC_RDP_MAX_READ_BUFFER 4194304

/**
 * Arbitrary device forwarded over the RDPDR channel.
 */
typedef struct guac_rdpdr_device guac_rdpdr_device;

/**
 * The contents of the header common to all RDPDR Device I/O Requests. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/a087ffa8-d0d5-4874-ac7b-0494f63e2d5d
 */
typedef struct guac_rdpdr_iorequest {

    /**
     * The unique ID assigned to the device receiving this I/O request.
     */
    int device_id;

    /**
     * The unique ID which identifies the relevant file, as returned when the
     * file was opened. This field may not be relevant to all requests.
     */
    int file_id;

    /**
     * The unique ID that should be used to refer to this I/O request in future
     * responses.
     */
    int completion_id;

    /**
     * Integer ID which identifies the function being requested, such as
     * IRP_MJ_CREATE (open a file within a shared drive) or IRP_MJ_WRITE (write
     * data to an open file).
     */
    int major_func;

    /**
     * Integer ID which identifies a variant of the function denoted by
     * major_func. This value is only valid for IRP_MJ_DIRECTORY_CONTROL.
     */
    int minor_func;

} guac_rdpdr_iorequest;

/**
 * Handler for Device I/O Requests. RDPDR devices must provide an
 * implementation of this function to be able to handle inbound I/O requests.
 *
 * @param svc
 *     The guac_rdp_common_svc representing the static virtual channel being
 *     used for RDPDR.
 *
 * @param device
 *     The guac_rdpdr_device of the relevant device, as dictated by the
 *     deviceId field of the common RDPDR header within the received PDU.
 *     Within the guac_rdpdr_iorequest structure, the deviceId field is stored
 *     within device_id.
 *
 * @param iorequest
 *     The contents of the common RDPDR Device I/O Request header shared by all
 *     RDPDR devices.
 *
 * @param input_stream
 *     The remaining data within the received PDU, following the common RDPDR
 *     Device I/O Request header.
 */
typedef void guac_rdpdr_device_iorequest_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream);

/**
 * Handler for cleaning up the dynamically-allocated portions of a device.
 *
 * @param svc
 *     The guac_rdp_common_svc representing the static virtual channel being
 *     used for RDPDR.
 *
 * @param device
 *     The guac_rdpdr_device of the device being freed.
 */
typedef void guac_rdpdr_device_free_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device);

struct guac_rdpdr_device {

    /**
     * The ID assigned to this device by the RDPDR plugin.
     */
    int device_id;

    /**
     * Device name, used for logging and for passthrough to the
     * server.
     */
    const char* device_name;

    /**
     * The type of RDPDR device that this represents.
     */
    uint32_t device_type;

    /**
     * The DOS name of the device. Max 8 bytes, including terminator.
     */
    const char *dos_name;
    
    /**
     * The stream that stores the RDPDR device announcement for this device.
     */
    wStream* device_announce;
    
    /**
     * The length of the device_announce wStream.
     */
    int device_announce_len;

    /**
     * Handler which should be called for every I/O request received.
     */
    guac_rdpdr_device_iorequest_handler* iorequest_handler;

    /**
     * Handler which should be called when the device is being freed.
     */
    guac_rdpdr_device_free_handler* free_handler;

    /**
     * Arbitrary data, used internally by the handlers for this device.
     */
    void* data;

};

/**
 * Structure representing the current state of the Guacamole RDPDR plugin for
 * FreeRDP.
 */
typedef struct guac_rdpdr {

    /**
     * The number of devices registered within the devices array.
     */
    int devices_registered;

    /**
     * Array of registered devices.
     */
    guac_rdpdr_device devices[8];

} guac_rdpdr;

/**
 * Creates a new stream which contains the common DR_DEVICE_IOCOMPLETION header
 * used for virtually all responses. Depending on the specific I/O completion
 * being sent, additional space may be reserved within the resulting stream for
 * additional fields. See:
 *
 * https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-rdpefs/10ef9ada-cba2-4384-ab60-7b6290ed4a9a
 *
 * @param device
 *     The device that completed the operation requested by a prior I/O
 *     request.
 *
 * @param completion_id
 *     The completion ID of the I/O request that requested the operation.
 *
 * @param status
 *     An NTSTATUS code describing the success/failure of the operation that
 *     was completed.
 *
 * @param size
 *     The number of additional bytes to reserve at the end of the resulting
 *     stream for additional fields to be appended.
 *
 * @return
 *     A new wStream containing an I/O completion header, followed by the
 *     requested additional free space.
 */
wStream* guac_rdpdr_new_io_completion(guac_rdpdr_device* device,
        unsigned int completion_id, unsigned int status, int size);

/**
 * Initializes device redirection support (file transfer, printing, etc.) for
 * RDP and handling of the RDPDR channel. If failures occur, messages noting
 * the specifics of those failures will be logged, and the RDP side of
 * device redirection support will not be functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for RDPDR support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the FreeRDP side of the RDP connection.
 */
void guac_rdpdr_load_plugin(rdpContext* context);

/**
 * Handler which is invoked when the RDPDR channel is connected to the RDP
 * server.
 */
guac_rdp_common_svc_connect_handler guac_rdpdr_process_connect;

/**
 * Handler which is invoked when the RDPDR channel has received data from the
 * RDP server.
 */
guac_rdp_common_svc_receive_handler guac_rdpdr_process_receive;

/**
 * Handler which is invoked when the RDPDR channel has disconnected and is
 * about to be freed.
 */
guac_rdp_common_svc_terminate_handler guac_rdpdr_process_terminate;

#endif

