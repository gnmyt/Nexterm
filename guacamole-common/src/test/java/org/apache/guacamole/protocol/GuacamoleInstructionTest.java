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

package org.apache.guacamole.protocol;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Unit test for GuacamoleParser. Verifies that parsing of the Guacamole
 * protocol works as required.
 */
public class GuacamoleInstructionTest {

    /**
     * A single test case for verifying that Guacamole protocol implementations
     * correctly parse or encode Guacamole instructions.
     */
    public static class TestCase extends GuacamoleInstruction {

        /**
         * The full and correct Guacamole protocol representation of this
         * instruction.
         */
        public final String UNPARSED;

        /**
         * The opcode that should be present in the Guacamole instruction;
         */
        public final String OPCODE;

        /**
         * All arguments that should be present in the Guacamole instruction;
         */
        public final List<String> ARGS;

        /**
         * Creates a new TestCase representing the given Guacamole instruction.
         *
         * @param unparsed
         *     The full and correct Guacamole protocol representation of this
         *     instruction.
         *
         * @param opcode
         *     The opcode of the Guacamole instruction.
         *
         * @param args
         *     The arguments of the Guacamole instruction, if any.
         */
        public TestCase(String unparsed, String opcode, String... args) {
            super(opcode, Arrays.copyOf(args, args.length));
            this.UNPARSED = unparsed;
            this.OPCODE = opcode;
            this.ARGS = Collections.unmodifiableList(Arrays.asList(args));
        }

    }

    /**
     * A single Unicode high surrogate character (any character between U+D800
     * and U+DB7F).
     */
    public static final String HIGH_SURROGATE = "\uD802";

    /**
     * A single Unicode low surrogate character (any character between U+DC00
     * and U+DFFF).
     */
    public static final String LOW_SURROGATE = "\uDF00";

    /**
     * A Unicode surrogate pair, consisting of a high and low surrogate.
     */
    public static final String SURROGATE_PAIR = HIGH_SURROGATE + LOW_SURROGATE;

    /**
     * A 4-character test string containing Unicode characters that require
     * multiple bytes when encoded as UTF-8, including at least one character
     * that is encoded as a surrogate pair in UTF-16.
     */
    public static final String UTF8_MULTIBYTE = "\u72AC" + SURROGATE_PAIR + "z\u00C1";

    /**
     * Pre-defined set of test cases for verifying Guacamole instructions are
     * correctly parsed and encoded.
     */
    public static List<TestCase> TEST_CASES = Collections.unmodifiableList(Arrays.asList(

        // Empty instruction
        new TestCase(
            "0.;",
            ""
        ),

        // Instruction using basic Latin characters
        new TestCase(

              "5.test2,"
            + "10.hellohello,"
            + "15.worldworldworld;",

            "test2",
            "hellohello",
            "worldworldworld"

        ),

        // Instruction using characters requiring multiple bytes in UTF-8 and
        // surrogate pairs in UTF-16, including an element ending with a surrogate
        // pair
        new TestCase(

              "4.ab" + HIGH_SURROGATE + HIGH_SURROGATE + ","
            + "6.a" + UTF8_MULTIBYTE + "b,"
            + "5.12345,"
            + "10.a" + UTF8_MULTIBYTE + UTF8_MULTIBYTE + "c;",

            "ab" + HIGH_SURROGATE + HIGH_SURROGATE,
            "a" + UTF8_MULTIBYTE + "b",
            "12345",
            "a" + UTF8_MULTIBYTE + UTF8_MULTIBYTE + "c"

        ),

        // Instruction with an element values ending with an incomplete surrogate
        // pair (high or low surrogate only)
        new TestCase(

              "4.test,"
            + "5.1234" + HIGH_SURROGATE + ","
            + "5.4567" + LOW_SURROGATE + ";",

            "test",
            "1234" + HIGH_SURROGATE,
            "4567" + LOW_SURROGATE

        ),

        // Instruction with element values containing incomplete surrogate pairs
        new TestCase(

              "5.te" + LOW_SURROGATE + "st,"
            + "5.12" + HIGH_SURROGATE + "3" + LOW_SURROGATE + ","
            + "6.5" + LOW_SURROGATE + LOW_SURROGATE + "4" + HIGH_SURROGATE + HIGH_SURROGATE + ","
            + "10." + UTF8_MULTIBYTE + HIGH_SURROGATE + UTF8_MULTIBYTE + HIGH_SURROGATE + ";",

            "te" + LOW_SURROGATE + "st",
            "12" + HIGH_SURROGATE + "3" + LOW_SURROGATE,
            "5" + LOW_SURROGATE + LOW_SURROGATE + "4" + HIGH_SURROGATE + HIGH_SURROGATE,
            UTF8_MULTIBYTE + HIGH_SURROGATE + UTF8_MULTIBYTE + HIGH_SURROGATE

        )

    ));

    /**
     * Verifies that instruction opcodes are represented correctly.
     */
    @Test
    public void testGetOpcode() {
        for (TestCase testCase : TEST_CASES) {
            assertEquals(testCase.OPCODE, testCase.getOpcode());
        }
    }

    /**
     * Verifies that instruction arguments are represented correctly.
     */
    @Test
    public void testGetArgs() {
        for (TestCase testCase : TEST_CASES) {
            assertEquals(testCase.ARGS, testCase.getArgs());
        }
    }

    /**
     * Verifies that instructions are encoded correctly.
     */
    @Test
    public void testToString() {
        for (TestCase testCase : TEST_CASES) {
            assertEquals(testCase.UNPARSED, testCase.toString());
        }
    }

}
