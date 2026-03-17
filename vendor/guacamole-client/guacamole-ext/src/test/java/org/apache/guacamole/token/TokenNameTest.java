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

package org.apache.guacamole.token;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

/**
 * Test which verifies automatic generation of connection parameter token names.
 */
public class TokenNameTest {

    /**
     * Verifies that TokenName.canonicalize() generates token names as
     * specified, regardless of the format of the provided string.
     */
    @Test
    public void testCanonicalize() {
        assertEquals("A", TokenName.canonicalize("a"));
        assertEquals("B", TokenName.canonicalize("b"));
        assertEquals("1", TokenName.canonicalize("1"));
        assertEquals("SOME_URL", TokenName.canonicalize("someURL"));
        assertEquals("LOWERCASE_WITH_DASHES", TokenName.canonicalize("lowercase-with-dashes"));
        assertEquals("HEADLESS_CAMEL_CASE", TokenName.canonicalize("headlessCamelCase"));
        assertEquals("CAMEL_CASE", TokenName.canonicalize("CamelCase"));
        assertEquals("CAMEL_CASE", TokenName.canonicalize("CamelCase"));
        assertEquals("LOWERCASE_WITH_UNDERSCORES", TokenName.canonicalize("lowercase_with_underscores"));
        assertEquals("UPPERCASE_WITH_UNDERSCORES", TokenName.canonicalize("UPPERCASE_WITH_UNDERSCORES"));
        assertEquals("A_VERY_INCONSISTENT_MIX_OF_ALL_STYLES", TokenName.canonicalize("aVery-INCONSISTENTMix_ofAllStyles"));
        assertEquals("ABC_123_DEF_456", TokenName.canonicalize("abc123def456"));
        assertEquals("ABC_123_DEF_456", TokenName.canonicalize("ABC123DEF456"));
        assertEquals("WORD_A_WORD_AB_WORD_ABC_WORD", TokenName.canonicalize("WordAWordABWordABCWord"));
        
        assertEquals("AUTH_ATTRIBUTE", TokenName.canonicalize("Attribute", "AUTH_"));
        assertEquals("auth_SOMETHING", TokenName.canonicalize("Something", "auth_"));
    }

}
