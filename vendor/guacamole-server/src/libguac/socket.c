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

#include "guacamole/mem.h"
#include "guacamole/error.h"
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/timestamp.h"

#include <inttypes.h>
#include <pthread.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

char __guac_socket_BASE64_CHARACTERS[64] = {
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd',
    'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
    't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7',
    '8', '9', '+', '/'
};

static void* __guac_socket_keep_alive_thread(void* data) {

    int old_cancelstate;

    /* Calculate sleep interval */
    struct timespec interval;
    interval.tv_sec  =  GUAC_SOCKET_KEEP_ALIVE_INTERVAL / 1000;
    interval.tv_nsec = (GUAC_SOCKET_KEEP_ALIVE_INTERVAL % 1000) * 1000000L;

    /* Socket keep-alive loop */
    guac_socket* socket = (guac_socket*) data;
    while (socket->state == GUAC_SOCKET_OPEN) {

        /* Send NOP keep-alive if it's been a while since the last output */
        guac_timestamp timestamp = guac_timestamp_current();
        if (timestamp - socket->last_write_timestamp >
                GUAC_SOCKET_KEEP_ALIVE_INTERVAL) {

            /* Send NOP */
            if (guac_protocol_send_nop(socket)
                || guac_socket_flush(socket))
                break;

        }

        /* Sleep until next keep-alive check, but allow thread cancellation
         * during that sleep */
        pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, &old_cancelstate);
        nanosleep(&interval, NULL);
        pthread_setcancelstate(PTHREAD_CANCEL_DISABLE, &old_cancelstate);

    }

    return NULL;

}

static ssize_t __guac_socket_write(guac_socket* socket,
        const void* buf, size_t count) {

    /* Update timestamp of last write */
    socket->last_write_timestamp = guac_timestamp_current();

    /* If handler defined, call it. */
    if (socket->write_handler)
        return socket->write_handler(socket, buf, count);

    /* Otherwise, pretend everything was written. */
    return count;

}

ssize_t guac_socket_write(guac_socket* socket,
        const void* buf, size_t count) {

    const char* buffer = buf;

    /* Write until completely written */
    while (count > 0) {

        /* Attempt to write, return on error */
        int written = __guac_socket_write(socket, buffer, count);
        if (written == -1)
            return 1;

        /* Advance buffer as data written */
        buffer += written;
        count  -= written;

    }

    return 0;

}

ssize_t guac_socket_read(guac_socket* socket, void* buf, size_t count) {

    /* If handler defined, call it. */
    if (socket->read_handler)
        return socket->read_handler(socket, buf, count);

    /* Otherwise, pretend nothing was read. */
    return 0;

}

int guac_socket_select(guac_socket* socket, int usec_timeout) {

    /* Call select handler if defined */
    if (socket->select_handler)
        return socket->select_handler(socket, usec_timeout);

    /* Otherwise, assume ready. */
    return 1;

}

guac_socket* guac_socket_alloc() {

    guac_socket* socket = guac_mem_alloc(sizeof(guac_socket));

    /* If no memory available, return with error */
    if (socket == NULL) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        guac_error_message = "Could not allocate memory for socket";
        return NULL;
    }

    socket->__ready = 0;
    socket->data = NULL;
    socket->state = GUAC_SOCKET_OPEN;
    socket->last_write_timestamp = guac_timestamp_current();

    /* No keep alive ping by default */
    socket->__keep_alive_enabled = 0;

    /* No handlers yet */
    socket->read_handler   = NULL;
    socket->write_handler  = NULL;
    socket->select_handler = NULL;
    socket->free_handler   = NULL;
    socket->flush_handler  = NULL;
    socket->lock_handler   = NULL;
    socket->unlock_handler = NULL;

    return socket;

}

void guac_socket_require_keep_alive(guac_socket* socket) {

    /* Start keep-alive thread */
    socket->__keep_alive_enabled = 1;
    pthread_create(&(socket->__keep_alive_thread), NULL,
                __guac_socket_keep_alive_thread, (void*) socket);

}

void guac_socket_instruction_begin(guac_socket* socket) {

    /* Call instruction begin handler if defined */
    if (socket->lock_handler)
        socket->lock_handler(socket);

}

void guac_socket_instruction_end(guac_socket* socket) {

    /* Call instruction end handler if defined */
    if (socket->unlock_handler)
        socket->unlock_handler(socket);

}

void guac_socket_free(guac_socket* socket) {

    guac_socket_flush(socket);

    /* Call free handler if defined */
    if (socket->free_handler)
        socket->free_handler(socket);

    /* Mark as closed */
    socket->state = GUAC_SOCKET_CLOSED;

    /* Stop keep-alive thread, if enabled */
    if (socket->__keep_alive_enabled) {
        pthread_cancel(socket->__keep_alive_thread);
        pthread_join(socket->__keep_alive_thread, NULL);
    }

    guac_mem_free(socket);
}

ssize_t guac_socket_write_int(guac_socket* socket, int64_t i) {

    char buffer[128];
    int length;

    /* Write provided integer as a string */
    length = snprintf(buffer, sizeof(buffer), "%"PRIi64, i);
    return guac_socket_write(socket, buffer, length);

}

ssize_t guac_socket_write_string(guac_socket* socket, const char* str) {

    /* Write contents of string */
    if (guac_socket_write(socket, str, strlen(str)))
        return 1;

    return 0;

}

/**
 * Encodes one to three bytes of data as four characters in base64 encoding.
 *
 * This function takes int arguments even though it's working with bytes to
 * allow -1 to be used as distinct sentinel value for missing data.
 *
 * @param a An int holding the first byte of data to encode. Only the
 *          least-significant byte will be used. This will always be inserted
 *          into the output.
 *
 * @param b An int holding the second byte of data to encode. Only the
 *          least-significant byte will be used. If this is less than zero,
 *          the second and third bytes will be ignored and the last two
 *          characters of the output will be '=' padding characters.
 *
 * @param c An int holding the third byte of data to encode. Only the
 *          least-significant byte will be used. If this is less than zero,
 *          the third byte will be ignored and the last character of the
 *          output will be a '=' padding character.
 *
 * @param output Character buffer to hold the output. Exactly four characters
 *               will be written to the buffer starting at this location.
 *
 * @return Returns zero.
 */
ssize_t __guac_socket_encode_base64(int a, int b, int c, char* output) {

    /* Byte 0:[AAAAAA] AABBBB BBBBCC CCCCCC */
    output[0] = __guac_socket_BASE64_CHARACTERS[(a & 0xFC) >> 2];

    if (b >= 0) {

        /* Byte 1: AAAAAA [AABBBB] BBBBCC CCCCCC */
        output[1] = __guac_socket_BASE64_CHARACTERS[((a & 0x03) << 4) | ((b & 0xF0) >> 4)];

        /*
         * Bytes 2 and 3, zero characters of padding:
         *
         * AAAAAA  AABBBB [BBBBCC] CCCCCC
         * AAAAAA  AABBBB  BBBBCC [CCCCCC]
         */
        if (c >= 0) {
            output[2] = __guac_socket_BASE64_CHARACTERS[((b & 0x0F) << 2) | ((c & 0xC0) >> 6)];
            output[3] = __guac_socket_BASE64_CHARACTERS[c & 0x3F];
        }

        /*
         * Bytes 2 and 3, one character of padding:
         *
         * AAAAAA  AABBBB [BBBB--] ------
         * AAAAAA  AABBBB  BBBB-- [------]
         */
        else {
            output[2] = __guac_socket_BASE64_CHARACTERS[((b & 0x0F) << 2)];
            output[3] = '=';
        }
    }

    /*
     * Bytes 1, 2, and 3, two characters of padding:
     *
     * AAAAAA [AA----] ------  ------
     * AAAAAA  AA---- [------] ------
     * AAAAAA  AA----  ------ [------]
     */
    else {
        output[1] = __guac_socket_BASE64_CHARACTERS[((a & 0x03) << 4)];
        output[2] = '=';
        output[3] = '=';
    }

    return 0;
}

ssize_t guac_socket_flush_base64(guac_socket* socket) {
    const unsigned char* src = socket->__ready_buf;

    int encodedCount = 0;
    int remaining = socket->__ready;

    /* Encode bytes in groups of three */
    while (remaining > 2) {
        __guac_socket_encode_base64(src[0], src[1], src[2], socket->__encoded_buf + encodedCount);

        remaining -= 3;
        src += 3;
        encodedCount += 4;
    }

    /* Take care of partial remnants */
    if (remaining == 2) {
        __guac_socket_encode_base64(src[0], src[1], -1, socket->__encoded_buf + encodedCount);
        encodedCount += 4;
    }
    else if (remaining == 1) {
        __guac_socket_encode_base64(src[0], -1, -1, socket->__encoded_buf + encodedCount);
        encodedCount += 4;
    }

    /* Write buffer to socket */
    int retval = guac_socket_write(socket, socket->__encoded_buf, encodedCount);
    if (retval < 0)
        return retval;

    socket->__ready = 0;

    return 0;

}

ssize_t guac_socket_write_base64(guac_socket* socket, const void* buf, size_t count) {

    const unsigned char* src = (const unsigned char*)buf;
    size_t remaining = count;
    int len;
    int retval;

    while (remaining > 0) {
        /* Fill ready buffer as much as possible */
        len = GUAC_SOCKET_BASE64_READY_BUFFER_SIZE - socket->__ready;
        if (remaining < len)
            len = remaining;

        memcpy(socket->__ready_buf + socket->__ready, src, len);

        socket->__ready += len;
        src += len;
        remaining -= len;

        /* Flush ready buffer when full */
        if (socket->__ready == GUAC_SOCKET_BASE64_READY_BUFFER_SIZE) {
            retval = guac_socket_flush_base64(socket);
            if (retval < 0)
                return retval;
        }
    }

    return 0;

}

ssize_t guac_socket_flush(guac_socket* socket) {

    /* If handler defined, call it. */
    if (socket->flush_handler)
        return socket->flush_handler(socket);

    /* Otherwise, do nothing */
    return 0;

}
