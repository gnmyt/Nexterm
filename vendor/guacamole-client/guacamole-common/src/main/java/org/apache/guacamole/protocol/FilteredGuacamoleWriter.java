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
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.io.GuacamoleWriter;

/**
 * GuacamoleWriter which applies a given GuacamoleFilter to observe or alter
 * all written instructions. Instructions may also be dropped or denied by
 * the filter.
 */
public class FilteredGuacamoleWriter implements GuacamoleWriter {

    /**
     * The wrapped GuacamoleWriter.
     */
    private final GuacamoleWriter writer;

    /**
     * The filter to apply when writing instructions.
     */
    private final GuacamoleFilter filter;

    /**
     * Parser for reading instructions prior to writing, such that they can be
     * passed on to the filter.
     */
    private final GuacamoleParser parser = new GuacamoleParser();
    
    /**
     * Wraps the given GuacamoleWriter, applying the given filter to all written 
     * instructions. Future writes will only write instructions which pass
     * the filter.
     *
     * @param writer The GuacamoleWriter to wrap.
     * @param filter The filter which dictates which instructions are written,
     *               and how.
     */
    public FilteredGuacamoleWriter(GuacamoleWriter writer, GuacamoleFilter filter) {
        this.writer = writer;
        this.filter = filter;
    }
 
    @Override
    public void write(char[] chunk, int offset, int length) throws GuacamoleException {

        // Write all data in chunk
        while (length > 0) {

            // Pass as much data through the parser as possible
            int parsed;
            while ((parsed = parser.append(chunk, offset, length)) != 0) {
                offset += parsed;
                length -= parsed;
            }

            // If no instruction is available, it must be incomplete
            if (!parser.hasNext())
                throw new GuacamoleServerException("Filtered write() contained an incomplete instruction.");

            // Write single instruction through filter
            writeInstruction(parser.next());

        }
        
    }

    @Override
    public void write(char[] chunk) throws GuacamoleException {
        write(chunk, 0, chunk.length);
    }

    @Override
    public void writeInstruction(GuacamoleInstruction instruction) throws GuacamoleException {

        // Write instruction only if not dropped
        GuacamoleInstruction filteredInstruction = filter.filter(instruction);
        if (filteredInstruction != null)
            writer.writeInstruction(filteredInstruction);

    }

}
