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

package org.apache.guacamole.net.auth;

import com.google.common.io.BaseEncoding;
import java.math.BigInteger;
import java.security.SecureRandom;

/**
 * Generator of unique and unpredictable identifiers. Each generated identifier
 * is an arbitrary, random string produced using a cryptographically-secure
 * random number generator.
 */
public class IdentifierGenerator {

    /**
     * Cryptographically-secure random number generator for generating unique
     * identifiers.
     */
    private static final SecureRandom secureRandom = new SecureRandom();

    /**
     * IdentifierGenerator is a utility class that is not intended to be
     * separately instantiated.
     */
    private IdentifierGenerator() {}
    
    /**
     * Generates a unique and unpredictable identifier. Each identifier is at
     * least 256-bit and produced using a cryptographically-secure random
     * number generator. The identifier may contain characters that differ only
     * in case.
     *
     * @return
     *     A unique and unpredictable identifier with at least 256 bits of
     *     entropy.
     */
    public static String generateIdentifier() {
        return generateIdentifier(256);
    }

    /**
     * Generates a unique and unpredictable identifier having at least the
     * given number of bits of entropy. The resulting identifier may have more
     * than the number of bits required. The identifier may contain characters
     * that differ only in case.
     *
     * @param minBits
     *     The number of bits of entropy that the identifier should contain.
     *
     * @return
     *     A unique and unpredictable identifier with at least the given number
     *     of bits of entropy.
     */
    public static String generateIdentifier(int minBits) {
        return generateIdentifier(minBits, true);
    }

    /**
     * Generates a unique and unpredictable identifier having at least the
     * given number of bits of entropy. The resulting identifier may have more
     * than the number of bits required. The identifier may contain characters
     * that differ only in case.
     *
     * @param minBits
     *     The number of bits of entropy that the identifier should contain.
     *
     * @param caseSensitive
     *     Whether identifiers are permitted to contain characters that vary
     *     by case. If false, all characters that may vary by case will be
     *     lowercase, and the generated identifier will be longer.
     *
     * @return
     *     A unique and unpredictable identifier with at least the given number
     *     of bits of entropy.
     */
    public static String generateIdentifier(int minBits, boolean caseSensitive) {

        // Generate a base64 identifier if we're allowed to vary by case
        if (caseSensitive) {
            int minBytes = (minBits + 23) / 24 * 3; // Round up to nearest multiple of 3 bytes, as base64 encodes blocks of 3 bytes at a time
            byte[] bytes = new byte[minBytes];
            secureRandom.nextBytes(bytes);
            return BaseEncoding.base64().encode(bytes);
        }

        // Generate base32 identifiers if we cannot vary by case
        minBits = (minBits + 4) / 5 * 5; // Round up to nearest multiple of 5 bits, as base32 encodes 5 bits at a time
        return new BigInteger(minBits, secureRandom).toString(32);

    }

}
