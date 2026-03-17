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

package org.apache.guacamole.io;


import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.protocol.GuacamoleInstruction;

/**
 * Provides abstract and raw character read access to a stream of Guacamole
 * instructions.
 */
public interface GuacamoleReader {

    /**
     * Returns whether instruction data is available for reading. Note that
     * this does not guarantee an entire instruction is available. If a full
     * instruction is not available, this function can return true, and a call
     * to read() will still block.
     *
     * @return true if instruction data is available for reading, false
     *         otherwise.
     * @throws GuacamoleException If an error occurs while checking for
     *                            available data.
     */
    public boolean available() throws GuacamoleException;

    /**
     * Reads at least one complete Guacamole instruction, returning a buffer
     * containing one or more complete Guacamole instructions and no
     * incomplete Guacamole instructions. This function will block until at
     * least one complete instruction is available.
     *
     * @return A buffer containing at least one complete Guacamole instruction,
     *         or null if no more instructions are available for reading.
     * @throws GuacamoleException If an error occurs while reading from the
     *                            stream.
     */
    public char[] read() throws GuacamoleException;

    /**
     * Reads exactly one complete Guacamole instruction and returns the fully
     * parsed instruction.
     *
     * @return The next complete instruction from the stream, fully parsed, or
     *         null if no more instructions are available for reading.
     * @throws GuacamoleException If an error occurs while reading from the
     *                            stream, or if the instruction cannot be
     *                            parsed.
     */
    public GuacamoleInstruction readInstruction() throws GuacamoleException;

}
