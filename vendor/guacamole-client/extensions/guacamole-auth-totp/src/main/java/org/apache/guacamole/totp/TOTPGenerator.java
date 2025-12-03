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

package org.apache.guacamole.totp;

import com.google.common.primitives.Longs;
import java.security.InvalidKeyException;
import java.security.Key;
import java.security.NoSuchAlgorithmException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/*
 * NOTE: This TOTP implementation is based on the TOTP reference implementation
 * provided by the IETF Trust at:
 *
 * https://tools.ietf.org/id/draft-mraihi-totp-timebased-07.html#Section-Reference-Impl
 */

/*
 * Copyright (c) 2011 IETF Trust and the persons identified as authors
 * of the code. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  - Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 *  - Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 *  - Neither the name of Internet Society, IETF or IETF Trust, nor the names
 *    of specific contributors, may be used to endorse or promote products
 *    derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS”
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Generator which uses the TOTP algorithm to generate authentication codes.
 */
public class TOTPGenerator {

    /**
     * The default time to use as the basis for comparison when transforming
     * provided TOTP timestamps into counter values required for HOTP, in
     * seconds since midnight, 1970-01-01, UTC (UNIX epoch).
     */
    public static final long DEFAULT_START_TIME = 0;

    /**
     * The default frequency at which new TOTP codes should be generated (and
     * old codes invalidated), in seconds.
     */
    public static final long DEFAULT_TIME_STEP = 30;

    /**
     * The TOTP generation mode. The mode dictates the hash function which
     * should be used to generate authentication codes, as well as the required
     * key size.
     */
    private final Mode mode;

    /**
     * The shared key to use to generate authentication codes. The size
     * required for this key depends on the generation mode.
     */
    private final Key key;

    /**
     * The length of codes to generate, in digits.
     */
    private final int length;

    /**
     * The base time against which the timestamp specified for each TOTP
     * should be compared to produce the corresponding HOTP counter value, in
     * seconds since midnight, 1970-01-01, UTC (UNIX epoch). This is the value
     * value referred to as "T0" in the TOTP specification.
     */
    private final long startTime;

    /**
     * The frequency that new TOTP codes should be generated and invalidated,
     * in seconds. This is the value referred to as "X" in the TOTP
     * specification.
     */
    private final long timeStep;

    /**
     * The operating mode for TOTP, defining the hash algorithm to be used.
     */
    public enum Mode {

        /**
         * TOTP mode which generates hashes using SHA1. TOTP in SHA1 mode
         * requires 160-bit keys.
         */
        @PropertyValue("sha1")
        SHA1("HmacSHA1", 20),

        /**
         * TOTP mode which generates hashes using SHA256. TOTP in SHA256 mode
         * requires 256-bit keys.
         */
        @PropertyValue("sha256")
        SHA256("HmacSHA256", 32),

        /**
         * TOTP mode which generates hashes using SHA512. TOTP in SHA512 mode
         * requires 512-bit keys.
         */
        @PropertyValue("sha512")
        SHA512("HmacSHA512", 64);

        /**
         * The name of the HMAC algorithm which the TOTP implementation should
         * use when operating in this mode, in the format required by
         * Mac.getInstance().
         */
        private final String algorithmName;

        /**
         * The recommended length of keys generated for TOTP in this mode, in
         * bytes. Keys are recommended to be the same length as the hash
         * involved.
         */
        private final int recommendedKeyLength;

        /**
         * Creates a new TOTP operating mode which is associated with the
         * given HMAC algorithm.
         *
         * @param algorithmName
         *     The name of the HMAC algorithm which the TOTP implementation
         *     should use when operating in this mode, in the format required
         *     by Mac.getInstance().
         *
         * @param recommendedKeyLength
         *     The recommended length of keys generated for TOTP in this mode,
         *     in bytes.
         */
        private Mode(String algorithmName, int recommendedKeyLength) {
            this.algorithmName = algorithmName;
            this.recommendedKeyLength = recommendedKeyLength;
        }

        /**
         * Returns the name of the HMAC algorithm which the TOTP implementation
         * should use when operating in this mode. The name returned will be
         * in the format required by Mac.getInstance().
         *
         * @return
         *     The name of the HMAC algorithm which the TOTP implementation
         *     should use.
         */
        public String getAlgorithmName() {
            return algorithmName;
        }

        /**
         * Returns the recommended length of keys generated for TOTP in this
         * mode, in bytes. Keys are recommended to be the same length as the
         * hash involved.
         *
         * @return
         *     The recommended length of keys generated for TOTP in this mode,
         *     in bytes.
         */
        public int getRecommendedKeyLength() {
            return recommendedKeyLength;
        }

    }

    /**
     * Creates a new TOTP generator which uses the given shared key to generate
     * authentication codes. The provided generation mode dictates the size of
     * the key required, while the given start time and time step dictate how
     * timestamps provided for code generation are converted to the counter
     * value used by HOTP (the algorithm which forms the basis of TOTP).
     *
     * @param key
     *     The shared key to use to generate authentication codes.
     *
     * @param mode
     *     The mode in which the TOTP algorithm should operate.
     *
     * @param length
     *     The length of the codes to generate, in digits. As required
     *     by the specification, this value MUST be at least 6 but no greater
     *     than 8.
     *
     * @param startTime
     *     The base time against which the timestamp specified for each TOTP
     *     should be compared to produce the corresponding HOTP counter value,
     *     in seconds since midnight, 1970-01-01, UTC (UNIX epoch). This is the
     *     value referred to as "T0" in the TOTP specification.
     *
     * @param timeStep
     *     The frequency that new TOTP codes should be generated and
     *     invalidated, in seconds. This is the value referred to as "X" in the
     *     TOTP specification.
     *
     * @throws InvalidKeyException
     *     If the provided key is invalid for the requested TOTP mode.
     */
    public TOTPGenerator(byte[] key, Mode mode, int length, long startTime,
            long timeStep) throws InvalidKeyException {

        // Validate length is within spec
        if (length < 6 || length > 8)
            throw new IllegalArgumentException("TOTP codes must be at least 6 "
                    + "digits and no more than 8 digits.");

        this.key = new SecretKeySpec(key, "RAW");
        this.mode = mode;
        this.length = length;
        this.startTime = startTime;
        this.timeStep = timeStep;

        // Verify key validity
        getMacInstance(this.mode, this.key);

    }

    /**
     * Creates a new TOTP generator which uses the given shared key to generate
     * authentication codes. The provided generation mode dictates the size of
     * the key required. The start time and time step used to produce the
     * counter value used by HOTP (the algorithm which forms the basis of TOTP)
     * are set to the default values recommended by the TOTP specification (0
     * and 30 respectively).
     *
     * @param key
     *     The shared key to use to generate authentication codes.
     *
     * @param mode
     *     The mode in which the TOTP algorithm should operate.
     *
     * @param length
     *     The length of the codes to generate, in digits. As required
     *     by the specification, this value MUST be at least 6 but no greater
     *     than 8.
     *
     * @throws InvalidKeyException
     *     If the provided key is invalid for the requested TOTP mode.
     */
    public TOTPGenerator(byte[] key, Mode mode, int length)
            throws InvalidKeyException {
        this(key, mode, length, DEFAULT_START_TIME, DEFAULT_TIME_STEP);
    }

    /**
     * Returns a new Mac instance which produces message authentication codes
     * using the given secret key and the algorithm required by the given TOTP
     * mode.
     *
     * @param mode
     *     The TOTP mode which dictates the HMAC algorithm to be used.
     *
     * @param key
     *     The secret key to use to produce message authentication codes.
     *
     * @return
     *     A new Mac instance which produces message authentication codes
     *     using the given secret key and the algorithm required by the given
     *     TOTP mode.
     *
     * @throws InvalidKeyException
     *     If the provided key is invalid for the requested TOTP mode.
     */
    private static Mac getMacInstance(Mode mode, Key key)
            throws InvalidKeyException {

        try {
            Mac hmac = Mac.getInstance(mode.getAlgorithmName());
            hmac.init(key);
            return hmac;
        }
        catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("Support for the HMAC "
                    + "algorithm required for TOTP in " + mode + " mode is "
                    + "missing.", e);
        }

    }

    /**
     * Calculates the HMAC for the given message using the key and algorithm
     * provided when this TOTPGenerator was created.
     *
     * @param message
     *     The message to calculate the HMAC of.
     *
     * @return
     *     The HMAC of the given message.
     */
    private byte[] getHMAC(byte[] message) {

        try {
            return getMacInstance(mode, key).doFinal(message);
        }
        catch (InvalidKeyException e) {

            // As the key is verified during construction of the TOTPGenerator,
            // this should never happen
            throw new IllegalStateException("Provided key became invalid after "
                    + "passing validation.", e);

        }

    }

    /**
     * Given an arbitrary integer value, returns a code containing the decimal
     * representation of that value and exactly the given number of digits. If
     * the given value has more than the desired number of digits, leading
     * digits will be truncated to reduce the length. If the given value has
     * fewer than the desired number of digits, leading zeroes will be added to
     * increase the length.
     *
     * @param value
     *     The value to convert into a decimal code of the given length.
     *
     * @param length
     *     The number of digits to include in the code.
     *
     * @return
     *     A code containing the decimal value of the given integer, truncated
     *     or padded such that exactly the given number of digits are present.
     */
    private String toCode(int value, int length) {

        // Convert value to simple integer string
        String valueString = Integer.toString(value);

        // If the resulting string is too long, truncate to the last N digits
        if (valueString.length() > length)
            return valueString.substring(valueString.length() - length);

        // Otherwise, add zeroes until the desired length is reached
        StringBuilder builder = new StringBuilder(length);
        for (int i = valueString.length(); i < length; i++)
            builder.append('0');

        // Return the padded integer string
        builder.append(valueString);
        return builder.toString();

    }

    /**
     * Generates a TOTP code of the given length using the given absolute
     * timestamp rather than the current system time.
     *
     * @param time
     *     The absolute timestamp to use to generate the TOTP code, in seconds
     *     since midnight, 1970-01-01, UTC (UNIX epoch).
     *
     * @return
     *     The TOTP code which corresponds to the given timestamp, having
     *     exactly the given length.
     *
     * @throws IllegalArgumentException
     *     If the given length is invalid as defined by the TOTP specification.
     */
    public String generate(long time) {

        // Calculate HOTP counter value based on provided time
        long counter = (time - startTime) / timeStep;
        byte[] hash = getHMAC(Longs.toByteArray(counter));

        // Calculate HOTP value as defined by section 5.2 of RFC 4226:
        // https://tools.ietf.org/html/rfc4226#section-5.2
        int offset = hash[hash.length - 1] & 0xF;
        int binary
                = ((hash[offset]     & 0x7F) << 24)
                | ((hash[offset + 1] & 0xFF) << 16)
                | ((hash[offset + 2] & 0xFF) << 8)
                |  (hash[offset + 3] & 0xFF);

        // Truncate or pad the value accordingly
        return toCode(binary, length);

    }

    /**
     * Generates a TOTP code of the given length using the current system time.
     *
     * @return
     *     The TOTP code which corresponds to the current system time, having
     *     exactly the given length.
     *
     * @throws IllegalArgumentException
     *     If the given length is invalid as defined by the TOTP specification.
     */
    public String generate() {
        return generate(System.currentTimeMillis() / 1000);
    }

    /**
     * Returns the TOTP code which would have been generated immediately prior
     * to the code returned by invoking generate() with the given timestamp.
     *
     * @param time
     *     The absolute timestamp to use to generate the TOTP code, in seconds
     *     since midnight, 1970-01-01, UTC (UNIX epoch).
     *
     * @return
     *     The TOTP code which would have been generated immediately prior to
     *     the code returned by invoking generate() with the given timestamp.
     */
    public String previous(long time) {
        return generate(Math.max(startTime, time - timeStep));
    }

    /**
     * Returns the TOTP code which would have been generated immediately prior
     * to the code currently being returned by generate().
     *
     * @return
     *     The TOTP code which would have been generated immediately prior to
     *     the code currently being returned by generate().
     */
    public String previous() {
        return previous(System.currentTimeMillis() / 1000);
    }

}
