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

package org.apache.guacamole.net;


import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;

/**
 * Provides a unique identifier and synchronized access to the GuacamoleReader
 * and GuacamoleWriter associated with a GuacamoleSocket.
 */
public interface GuacamoleTunnel {

    /**
     * The Guacamole protocol instruction opcode reserved for arbitrary
     * internal use by tunnel implementations. The value of this opcode is
     * guaranteed to be the empty string (""). Tunnel implementations may use
     * this opcode for any purpose. It is currently used by the HTTP tunnel to
     * mark the end of the HTTP response, and by the WebSocket tunnel to
     * transmit the tunnel UUID.
     */
    static final String INTERNAL_DATA_OPCODE = "";

    /**
     * Acquires exclusive read access to the Guacamole instruction stream
     * and returns a GuacamoleReader for reading from that stream.
     *
     * @return A GuacamoleReader for reading from the Guacamole instruction
     *         stream.
     */
    GuacamoleReader acquireReader();

    /**
     * Relinquishes exclusive read access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleReader.
     */
    void releaseReader();

    /**
     * Returns whether there are threads waiting for read access to the
     * Guacamole instruction stream.
     *
     * @return true if threads are waiting for read access the Guacamole
     *         instruction stream, false otherwise.
     */
    boolean hasQueuedReaderThreads();

    /**
     * Acquires exclusive write access to the Guacamole instruction stream
     * and returns a GuacamoleWriter for writing to that stream.
     *
     * @return A GuacamoleWriter for writing to the Guacamole instruction
     *         stream.
     */
    GuacamoleWriter acquireWriter();

    /**
     * Relinquishes exclusive write access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleWriter.
     */
    void releaseWriter();

    /**
     * Returns whether there are threads waiting for write access to the
     * Guacamole instruction stream.
     *
     * @return true if threads are waiting for write access the Guacamole
     *         instruction stream, false otherwise.
     */
    boolean hasQueuedWriterThreads();

    /**
     * Returns the unique identifier associated with this GuacamoleTunnel.
     *
     * @return The unique identifier associated with this GuacamoleTunnel.
     */
    UUID getUUID();

    /**
     * Returns the GuacamoleSocket used by this GuacamoleTunnel for reading
     * and writing.
     *
     * @return The GuacamoleSocket used by this GuacamoleTunnel.
     */
    GuacamoleSocket getSocket();

    /**
     * Release all resources allocated to this GuacamoleTunnel.
     *
     * @throws GuacamoleException if an error occurs while releasing
     *                            resources.
     */
    void close() throws GuacamoleException;

    /**
     * Returns whether this GuacamoleTunnel is open, or has been closed.
     *
     * @return true if this GuacamoleTunnel is open, false if it is closed.
     */
    boolean isOpen();

}
