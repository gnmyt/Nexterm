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

import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUpstreamException;
import org.apache.guacamole.GuacamoleUpstreamNotFoundException;
import org.apache.guacamole.GuacamoleUpstreamTimeoutException;
import org.apache.guacamole.GuacamoleUpstreamUnavailableException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.net.DelegatingGuacamoleSocket;
import org.apache.guacamole.net.GuacamoleSocket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * GuacamoleSocket which intercepts errors received early in the Guacamole
 * session. Upstream errors which are intercepted early enough result in
 * exceptions thrown immediately within the FailoverGuacamoleSocket's
 * constructor, allowing a different socket to be substituted prior to
 * fulfilling the connection.
 */
public class FailoverGuacamoleSocket extends DelegatingGuacamoleSocket {

    /**
     * Logger for this class.
     */
    private static final Logger logger =
            LoggerFactory.getLogger(FailoverGuacamoleSocket.class);

    /**
     * The default maximum number of characters of Guacamole instruction data
     * to store if no explicit limit is provided.
     */
    private static final int DEFAULT_INSTRUCTION_QUEUE_LIMIT = 131072;

    /**
     * Queue of all instructions read while this FailoverGuacamoleSocket was
     * being constructed.
     */
    private final Queue<GuacamoleInstruction> instructionQueue =
            new LinkedList<GuacamoleInstruction>();

    /**
     * Parses the given "error" instruction, throwing an exception if the
     * instruction represents an error from the upstream remote desktop.
     *
     * @param instruction
     *     The "error" instruction to parse.
     *
     * @throws GuacamoleUpstreamException
     *     If the "error" instruction represents an error from the upstream
     *     remote desktop.
     */
    private static void handleUpstreamErrors(GuacamoleInstruction instruction)
            throws GuacamoleUpstreamException {

        // Ignore error instructions which are missing the status code
        List<String> args = instruction.getArgs();
        if (args.size() < 2) {
            logger.debug("Received \"error\" instruction without status code.");
            return;
        }

        // Parse the status code from the received error instruction
        int statusCode;
        try {
            statusCode = Integer.parseInt(args.get(1));
        }
        catch (NumberFormatException e) {
            logger.debug("Received \"error\" instruction with non-numeric status code.", e);
            return;
        }

        // Translate numeric status code into a GuacamoleStatus
        GuacamoleStatus status = GuacamoleStatus.fromGuacamoleStatusCode(statusCode);
        if (status == null) {
            logger.debug("Received \"error\" instruction with unknown/invalid status code: {}", statusCode);
            return;
        }

        // Only handle error instructions related to the upstream remote desktop
        switch (status) {

            // Generic upstream error
            case UPSTREAM_ERROR:
                throw new GuacamoleUpstreamException(args.get(0));

            // Upstream is unreachable
            case UPSTREAM_NOT_FOUND:
                throw new GuacamoleUpstreamNotFoundException(args.get(0));

            // Upstream did not respond
            case UPSTREAM_TIMEOUT:
                throw new GuacamoleUpstreamTimeoutException(args.get(0));

            // Upstream is refusing the connection
            case UPSTREAM_UNAVAILABLE:
                throw new GuacamoleUpstreamUnavailableException(args.get(0));

        }

    }

    /**
     * Creates a new FailoverGuacamoleSocket which reads Guacamole instructions
     * from the given socket, searching for errors from the upstream remote
     * desktop until the given instruction queue limit is reached. If an
     * upstream error is encountered, it is thrown as a
     * GuacamoleUpstreamException. This constructor will block until an error
     * is encountered, until insufficient space remains in the instruction
     * queue, or until the connection appears to have been successful.
     * Once the FailoverGuacamoleSocket has been created, all reads, writes,
     * etc. will be delegated to the provided socket.
     *
     * @param socket
     *     The GuacamoleSocket of the Guacamole connection this
     *     FailoverGuacamoleSocket should handle.
     *
     * @param instructionQueueLimit
     *     The maximum number of characters of Guacamole instruction data to
     *     store within the instruction queue while searching for errors. Once
     *     this limit is exceeded, the connection is assumed to be successful.
     *
     * @throws GuacamoleException
     *     If an error occurs while reading data from the provided socket.
     *
     * @throws GuacamoleUpstreamException
     *     If the connection to guacd succeeded, but an error occurred while
     *     connecting to the remote desktop.
     */
    public FailoverGuacamoleSocket(GuacamoleSocket socket,
            final int instructionQueueLimit)
            throws GuacamoleException, GuacamoleUpstreamException {

        super(socket);

        int totalQueueSize = 0;

        GuacamoleInstruction instruction;
        GuacamoleReader reader = socket.getReader();

        // Continuously read instructions, searching for errors
        while ((instruction = reader.readInstruction()) != null) {

            // Add instruction to tail of instruction queue
            instructionQueue.add(instruction);

            // If instruction is a "sync" instruction, stop reading
            String opcode = instruction.getOpcode();
            if (opcode.equals("sync"))
                break;

            // If instruction is an "error" instruction, parse its contents and
            // stop reading
            if (opcode.equals("error")) {
                handleUpstreamErrors(instruction);
                break;
            }

            // Otherwise, track total data parsed, and assume connection is
            // successful if no error encountered within reasonable space
            totalQueueSize += instruction.toString().length();
            if (totalQueueSize >= instructionQueueLimit)
                break;

        }

    }

    /**
     * Creates a new FailoverGuacamoleSocket which reads Guacamole instructions
     * from the given socket, searching for errors from the upstream remote
     * desktop until a maximum of 128KB of instruction data has been queued. If
     * an upstream error is encountered, it is thrown as a
     * GuacamoleUpstreamException. This constructor will block until an error
     * is encountered, until insufficient space remains in the instruction
     * queue, or until the connection appears to have been successful.
     * Once the FailoverGuacamoleSocket has been created, all reads, writes,
     * etc. will be delegated to the provided socket.
     *
     * @param socket
     *     The GuacamoleSocket of the Guacamole connection this
     *     FailoverGuacamoleSocket should handle.
     *
     * @throws GuacamoleException
     *     If an error occurs while reading data from the provided socket.
     *
     * @throws GuacamoleUpstreamException
     *     If the connection to guacd succeeded, but an error occurred while
     *     connecting to the remote desktop.
     */
    public FailoverGuacamoleSocket(GuacamoleSocket socket)
            throws GuacamoleException, GuacamoleUpstreamException {
        this(socket, DEFAULT_INSTRUCTION_QUEUE_LIMIT);
    }

    /**
     * GuacamoleReader which reads instructions from the queue populated when
     * the FailoverGuacamoleSocket was constructed. Once the queue has been
     * emptied, reads are delegated directly to the reader of the wrapped
     * socket.
     */
    private final GuacamoleReader queuedReader = new GuacamoleReader() {

        @Override
        public boolean available() throws GuacamoleException {
            return !instructionQueue.isEmpty() || getDelegateSocket().getReader().available();
        }

        @Override
        public char[] read() throws GuacamoleException {

            // Read instructions from queue before finally delegating to
            // underlying reader (received when FailoverGuacamoleSocket was
            // being constructed)
            if (!instructionQueue.isEmpty()) {
                GuacamoleInstruction instruction = instructionQueue.remove();
                return instruction.toString().toCharArray();
            }

            return getDelegateSocket().getReader().read();

        }

        @Override
        public GuacamoleInstruction readInstruction()
                throws GuacamoleException {

            // Read instructions from queue before finally delegating to
            // underlying reader (received when FailoverGuacamoleSocket was
            // being constructed)
            if (!instructionQueue.isEmpty())
                return instructionQueue.remove();

            return getDelegateSocket().getReader().readInstruction();

        }

    };

    @Override
    public GuacamoleReader getReader() {
        return queuedReader;
    }

}
