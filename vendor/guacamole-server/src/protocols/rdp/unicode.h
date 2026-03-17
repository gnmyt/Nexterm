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

#ifndef GUAC_RDP_UNICODE_H
#define GUAC_RDP_UNICODE_H

/**
 * Convert the given number of UTF-16 characters to UTF-8 characters.
 *
 * @param utf16
 *     Arbitrary UTF-16 data.
 *
 * @param length
 *     The length of the UTF-16 data, in characters.
 *
 * @param utf8
 *     Buffer to which the converted UTF-8 data will be written.
 *
 * @param size
 *     The maximum number of bytes available in the UTF-8 buffer.
 */
void guac_rdp_utf16_to_utf8(const unsigned char* utf16, int length,
        char* utf8, int size);

/**
 * Convert the given number of UTF-8 characters to UTF-16 characters.
 *
 * @param utf8
 *     Arbitrary UTF-8 data.
 *
 * @param length
 *     The length of the UTF-8 data, in characters.
 *
 * @param utf16
 *     Buffer to which the converted UTF-16 data will be written.
 *
 * @param size
 *     The maximum number of bytes available in the UTF-16 buffer.
 */
void guac_rdp_utf8_to_utf16(const unsigned char* utf8, int length,
        char* utf16, int size);

#endif

