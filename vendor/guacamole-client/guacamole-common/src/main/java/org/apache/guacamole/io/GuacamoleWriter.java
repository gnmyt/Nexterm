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
 * Provides abstract and raw character write access to a stream of Guacamole
 * instructions.
 */
public interface GuacamoleWriter {

    /**
     * Writes a portion of the given array of characters to the Guacamole
     * instruction stream. The portion must contain only complete Guacamole
     * instructions.
     *
     * @param chunk An array of characters containing Guacamole instructions.
     * @param off The start offset of the portion of the array to write.
     * @param len The length of the portion of the array to write.
     * @throws GuacamoleException If an error occurred while writing the
     *                            portion of the array specified.
     */
    public void write(char[] chunk, int off, int len) throws GuacamoleException;

    /**
     * Writes the entire given array of characters to the Guacamole instruction
     * stream. The array must consist only of complete Guacamole instructions.
     *
     * @param chunk An array of characters consisting only of complete
     *              Guacamole instructions.
     * @throws GuacamoleException If an error occurred while writing the
     *                            the specified array.
     */
    public void write(char[] chunk) throws GuacamoleException;

    /**
     * Writes the given fully parsed instruction to the Guacamole instruction
     * stream.
     *
     * @param instruction The Guacamole instruction to write.
     * @throws GuacamoleException If an error occurred while writing the
     *                            instruction.
     */
    public void writeInstruction(GuacamoleInstruction instruction) throws GuacamoleException;

}
