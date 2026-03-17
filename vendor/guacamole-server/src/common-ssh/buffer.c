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

#include <openssl/bn.h>
#include <openssl/ossl_typ.h>

#include <guacamole/mem.h>

#include <stdint.h>
#include <string.h>
#include <stdlib.h>

void guac_common_ssh_buffer_write_byte(char** buffer, uint8_t value) {

    uint8_t* data = (uint8_t*) *buffer;
    *data = value;

    (*buffer)++;

}

void guac_common_ssh_buffer_write_uint32(char** buffer, uint32_t value) {

    uint8_t* data = (uint8_t*) *buffer;

    data[0] = (value & 0xFF000000) >> 24;
    data[1] = (value & 0x00FF0000) >> 16;
    data[2] = (value & 0x0000FF00) >> 8;
    data[3] =  value & 0x000000FF;

    *buffer += 4;

}

void guac_common_ssh_buffer_write_data(char** buffer, const char* data,
        int length) {
    memcpy(*buffer, data, length);
    *buffer += length;
}

void guac_common_ssh_buffer_write_bignum(char** buffer, const BIGNUM* value) {

    unsigned char* bn_buffer;
    int length;

    /* If zero, just write zero length */
    if (BN_is_zero(value)) {
        guac_common_ssh_buffer_write_uint32(buffer, 0);
        return;
    }

    /* Allocate output buffer, add padding byte */
    length = BN_num_bytes(value);
    bn_buffer = guac_mem_alloc(length);

    /* Convert BIGNUM */
    BN_bn2bin(value, bn_buffer);

    /* If first byte has high bit set, write padding byte */
    if (bn_buffer[0] & 0x80) {
        guac_common_ssh_buffer_write_uint32(buffer, length+1);
        guac_common_ssh_buffer_write_byte(buffer, 0);
    }
    else
        guac_common_ssh_buffer_write_uint32(buffer, length);

    /* Write data */
    memcpy(*buffer, bn_buffer, length);
    *buffer += length;

    guac_mem_free(bn_buffer);

}

void guac_common_ssh_buffer_write_string(char** buffer, const char* string,
        int length) {
    guac_common_ssh_buffer_write_uint32(buffer, length);
    guac_common_ssh_buffer_write_data(buffer, string, length);
}

uint8_t guac_common_ssh_buffer_read_byte(char** buffer) {

    uint8_t* data = (uint8_t*) *buffer;
    uint8_t value = *data;

    (*buffer)++;

    return value;

}

uint32_t guac_common_ssh_buffer_read_uint32(char** buffer) {

    uint8_t* data = (uint8_t*) *buffer;
    uint32_t value =
          (data[0] << 24)
        | (data[1] << 16)
        | (data[2] <<  8)
        |  data[3];

    *buffer += 4;

    return value;

}

char* guac_common_ssh_buffer_read_string(char** buffer, int* length) {

    char* value;

    *length = guac_common_ssh_buffer_read_uint32(buffer);
    value = *buffer;

    *buffer += *length;

    return value;

}

