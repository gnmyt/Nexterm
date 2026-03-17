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


import java.io.IOException;
import java.io.Reader;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.util.Deque;
import java.util.LinkedList;
import org.apache.guacamole.GuacamoleConnectionClosedException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.GuacamoleUpstreamTimeoutException;
import org.apache.guacamole.protocol.GuacamoleInstruction;

/**
 * A GuacamoleReader which wraps a standard Java Reader, using that Reader as
 * the Guacamole instruction stream.
 */
public class ReaderGuacamoleReader implements GuacamoleReader {

    /**
     * Wrapped Reader to be used for all input.
     */
    private Reader input;

    /**
     * Creates a new ReaderGuacamoleReader which will use the given Reader as
     * the Guacamole instruction stream.
     *
     * @param input The Reader to use as the Guacamole instruction stream.
     */
    public ReaderGuacamoleReader(Reader input) {
        this.input = input;
    }

    /**
     * The location within the received data buffer that parsing should begin
     * when more data is read.
     */
    private int parseStart;

    /**
     * The buffer holding all received, unparsed data.
     */
    private char[] buffer = new char[20480];

    /**
     * The number of characters currently used within the data buffer. All
     * other characters within the buffer are free space available for
     * future reads.
     */
    private int usedLength = 0;

    @Override
    public boolean available() throws GuacamoleException {
        try {
            return input.ready() || usedLength != 0;
        }
        catch (IOException e) {
            throw new GuacamoleServerException(e);
        }
    }

    @Override
    public char[] read() throws GuacamoleException {

        try {

            // While we're blocking, or input is available
            for (;;) {

                // Length of element
                int elementLength = 0;

                // Resume where we left off
                int i = parseStart;

                // Parse instruction in buffer
                while (i < usedLength) {

                    // Read character
                    char readChar = buffer[i++];

                    // If digit, update length
                    if (readChar >= '0' && readChar <= '9')
                        elementLength = elementLength * 10 + readChar - '0';

                    // If not digit, check for end-of-length character
                    else if (readChar == '.') {

                        // Check if element present in buffer
                        if (i + elementLength < usedLength) {

                            // Get terminator
                            char terminator = buffer[i + elementLength];

                            // Move to character after terminator
                            i += elementLength + 1;

                            // Reset length
                            elementLength = 0;

                            // Continue here if necessary
                            parseStart = i;

                            // If terminator is semicolon, we have a full
                            // instruction.
                            if (terminator == ';') {

                                // Copy instruction data
                                char[] instruction = new char[i];
                                System.arraycopy(buffer, 0, instruction, 0, i);

                                // Update buffer
                                usedLength -= i;
                                parseStart = 0;
                                System.arraycopy(buffer, i, buffer, 0, usedLength);

                                return instruction;

                            }

                            // Handle invalid terminator characters
                            else if (terminator != ',')
                                throw new GuacamoleServerException("Element terminator of instruction was not ';' nor ','");

                        }

                        // Otherwise, read more data
                        else
                            break;

                    }

                    // Otherwise, parse error
                    else
                        throw new GuacamoleServerException("Non-numeric character in element length.");

                }

                // If past threshold, resize buffer before reading
                if (usedLength > buffer.length/2) {
                    char[] biggerBuffer = new char[buffer.length*2];
                    System.arraycopy(buffer, 0, biggerBuffer, 0, usedLength);
                    buffer = biggerBuffer;
                }

                // Attempt to fill buffer
                int numRead = input.read(buffer, usedLength, buffer.length - usedLength);
                if (numRead == -1)
                    return null;

                // Update used length
                usedLength += numRead;

            } // End read loop

        }
        catch (SocketTimeoutException e) {
            throw new GuacamoleUpstreamTimeoutException("Connection to guacd timed out.", e);
        }
        catch (SocketException e) {
            throw new GuacamoleConnectionClosedException("Connection to guacd is closed.", e);
        }
        catch (IOException e) {
            throw new GuacamoleServerException(e);
        }

    }

    @Override
    public GuacamoleInstruction readInstruction() throws GuacamoleException {

        // Get instruction
        char[] instructionBuffer = read();

        // If EOF, return EOF
        if (instructionBuffer == null)
            return null;

        // Start of element
        int elementStart = 0;

        // Build list of elements
        Deque<String> elements = new LinkedList<String>();
        while (elementStart < instructionBuffer.length) {

            // Find end of length
            int lengthEnd = -1;
            for (int i=elementStart; i<instructionBuffer.length; i++) {
                if (instructionBuffer[i] == '.') {
                    lengthEnd = i;
                    break;
                }
            }

            // read() is required to return a complete instruction. If it does
            // not, this is a severe internal error.
            if (lengthEnd == -1)
                throw new GuacamoleServerException("Read returned incomplete instruction.");

            // Parse length
            int length = Integer.parseInt(new String(
                    instructionBuffer,
                    elementStart,
                    lengthEnd - elementStart
            ));

            // Parse element from just after period
            elementStart = lengthEnd + 1;
            String element = new String(
                    instructionBuffer,
                    elementStart,
                    length
            );

            // Append element to list of elements
            elements.addLast(element);

            // Read terminator after element
            elementStart += length;
            char terminator = instructionBuffer[elementStart];

            // Continue reading instructions after terminator
            elementStart++;

            // If we've reached the end of the instruction
            if (terminator == ';')
                break;

        }

        // Pull opcode off elements list
        String opcode = elements.removeFirst();

        // Create instruction
        GuacamoleInstruction instruction = new GuacamoleInstruction(
                opcode,
                elements.toArray(new String[elements.size()])
        );

        // Return parsed instruction
        return instruction;

    }

}
