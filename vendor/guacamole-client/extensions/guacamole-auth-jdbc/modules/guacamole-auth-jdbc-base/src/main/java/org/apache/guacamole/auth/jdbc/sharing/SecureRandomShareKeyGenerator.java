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

package org.apache.guacamole.auth.jdbc.sharing;

import java.security.SecureRandom;

/**
 * An implementation of the ShareKeyGenerator which uses SecureRandom to
 * generate cryptographically-secure random sharing keys.
 */
public class SecureRandomShareKeyGenerator extends SecureRandom
        implements ShareKeyGenerator {

    /**
     * The length of each generated share key, in base64-digits.
     */
    private static final int KEY_LENGTH = 44;

    /**
     * The character representations of each possible base64 digit. This class
     * uses the URL-safe variant of base64 (also known as "base64url"), which
     * uses '-' and '_' instead of '+' and '/' for digits 62 and 63
     * respectively. See RFC 4648, Section 5: "Base 64 Encoding with URL and
     * Filename Safe Alphabet" (https://tools.ietf.org/html/rfc4648#section-5).
     */
    private static final char[] URL_SAFE_BASE64_DIGITS = {
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
    };

    @Override
    public String getShareKey() {

        // Produce storage space for required share key length
        char[] key = new char[KEY_LENGTH];

        // Fill key with random digits
        for (int i = 0; i < KEY_LENGTH; i++)
            key[i] = URL_SAFE_BASE64_DIGITS[next(6)];

        return new String(key);

    }

}
