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

import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.DelegatingGuacamoleSocket;
import org.apache.guacamole.net.GuacamoleSocket;

/**
 * Implementation of GuacamoleSocket which allows individual instructions to be
 * intercepted, overridden, etc.
 */
public class FilteredGuacamoleSocket extends DelegatingGuacamoleSocket {

    /**
     * A reader for the wrapped GuacamoleSocket which may be filtered.
     */
    private final GuacamoleReader reader;
    
    /**
     * A writer for the wrapped GuacamoleSocket which may be filtered.
     */
    private final GuacamoleWriter writer;
    
    /**
     * Creates a new FilteredGuacamoleSocket which uses the given filters to
     * determine whether instructions read/written are allowed through,
     * modified, etc. If reads or writes should be unfiltered, simply specify
     * null rather than a particular filter.
     *
     * @param socket The GuacamoleSocket to wrap.
     * @param readFilter The GuacamoleFilter to apply to all read instructions,
     *                   if any.
     * @param writeFilter The GuacamoleFilter to apply to all written 
     *                    instructions, if any.
     */
    public FilteredGuacamoleSocket(GuacamoleSocket socket, GuacamoleFilter readFilter, GuacamoleFilter writeFilter) {

        super(socket);

        // Apply filter to reader
        if (readFilter != null)
            reader = new FilteredGuacamoleReader(socket.getReader(), readFilter);
        else
            reader = socket.getReader();

        // Apply filter to writer
        if (writeFilter != null)
            writer = new FilteredGuacamoleWriter(socket.getWriter(), writeFilter);
        else
            writer = socket.getWriter();

    }
    
    @Override
    public GuacamoleReader getReader() {
        return reader;
    }

    @Override
    public GuacamoleWriter getWriter() {
        return writer;
    }

}
