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

package org.apache.guacamole.tunnel;

import com.google.common.io.BaseEncoding;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleInstruction;
import org.apache.guacamole.protocol.GuacamoleStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Filter which selectively intercepts "blob" and "end" instructions,
 * automatically writing to or closing the stream given with
 * interceptStream(). The required "ack" responses to received blobs are
 * sent automatically.
 */
public class OutputStreamInterceptingFilter
        extends StreamInterceptingFilter<OutputStream> {

    /**
     * Logger for this class.
     */
    private static final Logger logger =
            LoggerFactory.getLogger(OutputStreamInterceptingFilter.class);

    /**
     * Whether this OutputStreamInterceptingFilter should respond to received
     * blobs with "ack" messages on behalf of the client. If false, blobs will
     * still be handled by this filter, but empty blobs will be sent to the
     * client, forcing the client to respond on its own.
     */
    private boolean acknowledgeBlobs = true;

    /**
     * Creates a new OutputStreamInterceptingFilter which selectively intercepts
     * "blob" and "end" instructions. The required "ack" responses will
     * automatically be sent over the given tunnel.
     *
     * @param tunnel
     *     The GuacamoleTunnel over which any required "ack" instructions
     *     should be sent.
     */
    public OutputStreamInterceptingFilter(GuacamoleTunnel tunnel) {
        super(tunnel);
    }

    /**
     * Injects an "ack" instruction into the outbound Guacamole protocol
     * stream, as if sent by the connected client. "ack" instructions are used
     * to acknowledge the receipt of a stream and its subsequent blobs, and are
     * the only means of communicating success/failure status.
     *
     * @param index
     *     The index of the stream that this "ack" instruction relates to.
     *
     * @param message
     *     An arbitrary human-readable message to include within the "ack"
     *     instruction.
     *
     * @param status
     *     The status of the stream operation being acknowledged via the "ack"
     *     instruction. Error statuses will implicitly close the stream via
     *     closeStream().
     */
    private void sendAck(String index, String message, GuacamoleStatus status) {

        // Error "ack" instructions implicitly close the stream
        if (status != GuacamoleStatus.SUCCESS)
            closeInterceptedStream(index);

        sendInstruction(new GuacamoleInstruction("ack", index, message,
                Integer.toString(status.getGuacamoleStatusCode())));

    }

    /**
     * Handles a single "blob" instruction, decoding its base64 data,
     * sending that data to the associated OutputStream, and ultimately
     * dropping the "blob" instruction such that the client never receives
     * it. If no OutputStream is associated with the stream index within
     * the "blob" instruction, the instruction is passed through untouched.
     *
     * @param instruction
     *     The "blob" instruction being handled.
     *
     * @return
     *     The originally-provided "blob" instruction, if that instruction
     *     should be passed through to the client, or null if the "blob"
     *     instruction should be dropped.
     */
    private GuacamoleInstruction handleBlob(GuacamoleInstruction instruction) {

        // Verify all required arguments are present
        List<String> args = instruction.getArgs();
        if (args.size() < 2)
            return instruction;

        // Pull associated stream
        String index = args.get(0);
        InterceptedStream<OutputStream> stream = getInterceptedStream(index);
        if (stream == null)
            return instruction;

        // Decode blob
        byte[] blob;
        try {
            String data = args.get(1);
            blob = BaseEncoding.base64().decode(data);
        }
        catch (IllegalArgumentException e) {
            logger.warn("Received base64 data for intercepted stream was invalid.");
            logger.debug("Decoding base64 data for intercepted stream failed.", e);
            return null;
        }

        try {

            // Attempt to write data to stream
            stream.getStream().write(blob);

            // Force client to respond with their own "ack" if we need to
            // confirm that they are not falling behind with respect to the
            // graphical session
            if (!acknowledgeBlobs) {
                acknowledgeBlobs = true;
                return new GuacamoleInstruction("blob", index, "");
            }

            // Otherwise, acknowledge the blob on the client's behalf
            sendAck(index, "OK", GuacamoleStatus.SUCCESS);

        }
        catch (IOException e) {
            sendAck(index, "FAIL", GuacamoleStatus.SERVER_ERROR);
            logger.debug("Write failed for intercepted stream.", e);
        }

        // Instruction was handled purely internally
        return null;

    }

    /**
     * Handles a single "end" instruction, closing the associated
     * OutputStream. If no OutputStream is associated with the stream index
     * within the "end" instruction, this function has no effect.
     *
     * @param instruction
     *     The "end" instruction being handled.
     */
    private void handleEnd(GuacamoleInstruction instruction) {

        // Verify all required arguments are present
        List<String> args = instruction.getArgs();
        if (args.size() < 1)
            return;

        // Terminate stream
        closeInterceptedStream(args.get(0));

    }

    /**
     * Handles a single "sync" instruction, updating internal tracking of
     * client render state.
     *
     * @param instruction
     *     The "sync" instruction being handled.
     */
    private void handleSync(GuacamoleInstruction instruction) {
        acknowledgeBlobs = false;
    }

    @Override
    public GuacamoleInstruction filter(GuacamoleInstruction instruction)
            throws GuacamoleException {

        // Intercept "blob" instructions for in-progress streams
        if (instruction.getOpcode().equals("blob"))
            return handleBlob(instruction);

        // Intercept "end" instructions for in-progress streams
        if (instruction.getOpcode().equals("end")) {
            handleEnd(instruction);
            return instruction;
        }

        // Monitor "sync" instructions to ensure the client does not starve
        // from lack of graphical updates
        if (instruction.getOpcode().equals("sync")) {
            handleSync(instruction);
            return instruction;
        }

        // Pass instruction through untouched
        return instruction;

    }

    @Override
    protected void handleInterceptedStream(InterceptedStream<OutputStream> stream) {

        // Acknowledge that the stream is ready to receive data
        sendAck(stream.getIndex(), "OK", GuacamoleStatus.SUCCESS);

    }

}
