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

import org.apache.guacamole.GuacamoleException;
import static org.apache.guacamole.protocol.GuacamoleInstructionTest.TEST_CASES;
import org.apache.guacamole.protocol.GuacamoleInstructionTest.TestCase;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Unit test for GuacamoleParser. Verifies that parsing of the Guacamole
 * protocol works as required.
 */
public class GuacamoleParserTest {

    /**
     * The GuacamoleParser instance being tested.
     */
    private final GuacamoleParser parser = new GuacamoleParser();

    /**
     * Verify that GuacamoleParser correctly parses each of the instruction
     * test cases included in the GuacamoleInstruction test.
     *
     * @throws GuacamoleException
     *     If a parse error occurs.
     */
    @Test
    public void testParser() throws GuacamoleException {

        // Build buffer containing all of the instruction test cases, one after
        // the other
        StringBuilder allTestCases = new StringBuilder();
        for (TestCase testCase : TEST_CASES)
            allTestCases.append(testCase.UNPARSED);

        // Prepare buffer and offsets for feeding the data into the parser as
        // if received over the network
        char buffer[] = allTestCases.toString().toCharArray();
        int offset = 0;
        int length = buffer.length;

        // Verify that each of the expected instructions is received in order
        for (TestCase testCase : TEST_CASES) {

            // Feed data into parser until parser refuses to receive more data
            int parsed;
            while (length > 0 && (parsed = parser.append(buffer, offset, length)) != 0) {
                offset += parsed;
                length -= parsed;
            }

            // An instruction should now be parsed and ready for retrieval
            assertTrue(parser.hasNext());

            // Verify instruction contains expected opcode and args
            GuacamoleInstruction instruction = parser.next();
            assertNotNull(instruction);
            assertEquals(testCase.OPCODE, instruction.getOpcode());
            assertEquals(testCase.ARGS, instruction.getArgs());

        }

        // There should be no more instructions
        assertFalse(parser.hasNext());

    }

}
