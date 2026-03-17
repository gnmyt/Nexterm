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

#include <windows.h>
#include <winbase.h>
#include <wtsapi32.h>

#include <stdio.h>

/**
 * The name of the RDP static virtual channel (SVC).
 */
#define SVC_NAME "EXAMPLE"

int main() {

    ULONG bytes_read;
    ULONG bytes_written;

    char message[4096];

    /* Open SVC */
    HANDLE svc = WTSVirtualChannelOpenEx(WTS_CURRENT_SESSION, SVC_NAME, 0);

    /* Fail if we cannot open an SVC at all */
    if (svc == NULL) {
        printf("Cannot open SVC \"" SVC_NAME "\"\n");
        return 0;
    }

    printf("SVC \"" SVC_NAME "\" open. Reading...\n");

    /* Continuously read from SVC */
    while (WTSVirtualChannelRead(svc, INFINITE, message, sizeof(message), &bytes_read)) {

        printf("Received %i bytes.\n", bytes_read);

        /* Write all received data back to the SVC, possibly spreading the data
         * across multiple writes */
        char* current = message;
        while (bytes_read > 0 && WTSVirtualChannelWrite(svc, current,
                    bytes_read, &bytes_written)) {
            printf("Wrote %i bytes.\n", bytes_written);
            bytes_read -= bytes_written;
        }

    }

    /* Close SVC */
    WTSVirtualChannelClose(svc);
    printf("SVC \"" SVC_NAME "\" closed.\n");
    return 1;

}

