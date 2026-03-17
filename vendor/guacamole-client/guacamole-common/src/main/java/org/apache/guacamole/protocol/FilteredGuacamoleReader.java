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
import org.apache.guacamole.io.GuacamoleReader;

/**
 * GuacamoleReader which applies a given GuacamoleFilter to observe or alter all
 * read instructions. Instructions may also be dropped or denied by the filter.
 */
public class FilteredGuacamoleReader implements GuacamoleReader {

    /**
     * The wrapped GuacamoleReader.
     */
    private final GuacamoleReader reader;

    /**
     * The filter to apply when reading instructions.
     */
    private final GuacamoleFilter filter;

    /**
     * Wraps the given GuacamoleReader, applying the given filter to all read
     * instructions. Future reads will return only instructions which pass
     * the filter.
     *
     * @param reader The GuacamoleReader to wrap.
     * @param filter The filter which dictates which instructions are read, and
     *               how.
     */
    public FilteredGuacamoleReader(GuacamoleReader reader, GuacamoleFilter filter) {
        this.reader = reader;
        this.filter = filter;
    }
    
    @Override
    public boolean available() throws GuacamoleException {
        return reader.available();
    }

    @Override
    public char[] read() throws GuacamoleException {

        GuacamoleInstruction filteredInstruction = readInstruction();
        if (filteredInstruction == null)
            return null;

        return filteredInstruction.toString().toCharArray();
        
    }

    @Override
    public GuacamoleInstruction readInstruction() throws GuacamoleException {

        GuacamoleInstruction filteredInstruction;

        // Read and filter instructions until no instructions are dropped
        do {

            // Read next instruction
            GuacamoleInstruction unfilteredInstruction = reader.readInstruction();
            if (unfilteredInstruction == null)
                return null;

            // Apply filter
            filteredInstruction = filter.filter(unfilteredInstruction);

        } while (filteredInstruction == null);

        return filteredInstruction;
        
    }

}
