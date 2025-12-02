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

import java.io.StringWriter;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.io.WriterGuacamoleWriter;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Test which validates filtering of Guacamole instructions with
 * FilteredGuacamoleWriter.
 */
public class FilteredGuacamoleWriterTest {

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

        StringWriter stringWriter = new StringWriter();
        GuacamoleWriter writer = new FilteredGuacamoleWriter(new WriterGuacamoleWriter(stringWriter),
                                                             new TestFilter());

        // Write a few chunks of complete instructions
        writer.write("3.yes,1.A;2.no,1.B;3.yes,1.C;3.yes,1.D;4.nope,1.E;".toCharArray());
        writer.write("1.n,3.abc;3.yes,5.hello;2.no,4.test;3.yes,5.world;".toCharArray());

        // Validate filtered results
        assertEquals("3.yes,1.A;3.yes,1.C;3.yes,1.D;3.yes,5.hello;3.yes,5.world;", stringWriter.toString());

    }
    
}
