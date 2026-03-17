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

import java.security.InvalidKeyException;
import org.junit.Test;
import static org.junit.Assert.*;

/*
 * NOTE: The tests for this TOTP implementation is based on the TOTP reference
 * implementation provided by the IETF Trust at:
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
 * Test which verifies the correctness of the TOTPGenerator class against the
 * test inputs and results provided in the IETF reference implementation and
 * spec for TOTP:
 *
 * https://tools.ietf.org/id/draft-mraihi-totp-timebased-07.html#Section-Test-Vectors
 */
public class TOTPGeneratorTest {

    /**
     * Verifies the results of generating authentication codes using the TOTP
     * algorithm in SHA1 mode.
     */
    @Test
    public void testGenerateSHA1() {

        // 160-bit key consisting of the bytes "12345678901234567890" repeated
        // as necessary
        final byte[] key = {
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
        };

        try {
            final TOTPGenerator totp = new TOTPGenerator(key, TOTPGenerator.Mode.SHA1, 8);
            assertEquals("94287082", totp.generate(59));
            assertEquals("07081804", totp.generate(1111111109));
            assertEquals("14050471", totp.generate(1111111111));
            assertEquals("89005924", totp.generate(1234567890));
            assertEquals("69279037", totp.generate(2000000000));
            assertEquals("65353130", totp.generate(20000000000L));
        }
        catch (InvalidKeyException e) {
            fail("SHA1 test key is invalid.");
        }


    }

    /**
     * Verifies the results of generating authentication codes using the TOTP
     * algorithm in SHA256 mode.
     */
    @Test
    public void testGenerateSHA256() {

        // 256-bit key consisting of the bytes "12345678901234567890" repeated
        // as necessary
        final byte[] key = {
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2'
        };

        try {
            final TOTPGenerator totp = new TOTPGenerator(key, TOTPGenerator.Mode.SHA256, 8);
            assertEquals("46119246", totp.generate(59));
            assertEquals("68084774", totp.generate(1111111109));
            assertEquals("67062674", totp.generate(1111111111));
            assertEquals("91819424", totp.generate(1234567890));
            assertEquals("90698825", totp.generate(2000000000));
            assertEquals("77737706", totp.generate(20000000000L));
        }
        catch (InvalidKeyException e) {
            fail("SHA256 test key is invalid.");
        }

    }

    /**
     * Verifies the results of generating authentication codes using the TOTP
     * algorithm in SHA512 mode.
     */
    @Test
    public void testGenerateSHA512() {

        // 512-bit key consisting of the bytes "12345678901234567890" repeated
        // as necessary
        final byte[] key = {
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '1', '2', '3', '4'
        };

        try {
            final TOTPGenerator totp = new TOTPGenerator(key, TOTPGenerator.Mode.SHA512, 8);
            assertEquals("90693936", totp.generate(59));
            assertEquals("25091201", totp.generate(1111111109));
            assertEquals("99943326", totp.generate(1111111111));
            assertEquals("93441116", totp.generate(1234567890));
            assertEquals("38618901", totp.generate(2000000000));
            assertEquals("47863826", totp.generate(20000000000L));
        }
        catch (InvalidKeyException e) {
            fail("SHA512 test key is invalid.");
        }

    }

}
