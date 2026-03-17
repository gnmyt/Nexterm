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

#ifndef GUAC_RDP_CHANNELS_RDPDR_PRINTER_H
#define GUAC_RDP_CHANNELS_RDPDR_PRINTER_H

#include "channels/common-svc.h"
#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

/**
 * Name of the printer driver that should be used on the server.
 */
#define GUAC_PRINTER_DRIVER "M\0S\0 \0P\0u\0b\0l\0i\0s\0h\0e\0r\0 \0I\0m\0a\0g\0e\0s\0e\0t\0t\0e\0r\0\0\0"

/**
 * The size of GUAC_PRINTER_DRIVER in bytes.
 */
#define GUAC_PRINTER_DRIVER_LENGTH 50

/**
 * Registers a new printer device within the RDPDR plugin. This must be done
 * before RDPDR connection finishes.
 * 
 * @param svc
 *     The static virtual channel instance being used for RDPDR.
 * 
 * @param printer_name
 *     The name of the printer that will be registered with the RDP
 *     connection and passed through to the server.
 */
void guac_rdpdr_register_printer(guac_rdp_common_svc* svc, char* printer_name);

/**
 * I/O request handler which processes a print job creation request.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_process_print_job_create;

/**
 * I/O request handler which processes a request to write data to an existing
 * print job.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_process_print_job_write;

/**
 * I/O request handler which processes a request to close an existing print
 * job.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_process_print_job_close;

/**
 * Handler for RDPDR Device I/O Requests which processes received messages on
 * behalf of a printer device, in this case a simulated printer which produces
 * PDF output.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_device_printer_iorequest_handler;

/**
 * Free handler which frees all data specific to the simulated printer device.
 */
guac_rdpdr_device_free_handler guac_rdpdr_device_printer_free_handler;

#endif

