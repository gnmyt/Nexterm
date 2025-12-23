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

import java.io.StringReader;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.ReaderGuacamoleReader;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Test which validates filtering of Guacamole instructions with
 * FilteredGuacamoleReader.
 */
public class FilteredGuacamoleReaderTest {

    /**
     * Filter which allows through "yes" instructions but drops all others.
     */
    private static class TestFilter implements GuacamoleFilter {

        @Override
        public GuacamoleInstruction filter(GuacamoleInstruction instruction) throws GuacamoleException {

            if (instruction.getOpcode().equals("yes"))
                return instruction;

            return null;
            
        }

    }
    
    @Test
    public void testFilter() throws Exception {

        // Test string
        final String test = "3.yes,1.A;2.no,1.B;3.yes,1.C;3.yes,1.D;4.nope,1.E;";

        GuacamoleReader reader = new FilteredGuacamoleReader(new ReaderGuacamoleReader(new StringReader(test)),
                                                             new TestFilter());

        GuacamoleInstruction instruction;

        // Validate first instruction
        instruction = reader.readInstruction();
        assertNotNull(instruction);
        assertEquals("yes", instruction.getOpcode());
        assertEquals(1, instruction.getArgs().size());
        assertEquals("A", instruction.getArgs().get(0));

        // Validate second instruction
        instruction = reader.readInstruction();
        assertNotNull(instruction);
        assertEquals("yes", instruction.getOpcode());
        assertEquals(1, instruction.getArgs().size());
        assertEquals("C", instruction.getArgs().get(0));

        // Validate third instruction
        instruction = reader.readInstruction();
        assertNotNull(instruction);
        assertEquals("yes", instruction.getOpcode());
        assertEquals(1, instruction.getArgs().size());
        assertEquals("D", instruction.getArgs().get(0));

        // Should be done now
        instruction = reader.readInstruction();
        assertNull(instruction);

    }
    
}
