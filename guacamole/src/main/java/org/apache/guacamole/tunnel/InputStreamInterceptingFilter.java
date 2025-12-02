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
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleInstruction;
import org.apache.guacamole.protocol.GuacamoleStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Filter which selectively intercepts "ack" instructions, automatically reading
 * from or closing the stream given with interceptStream(). The required "blob"
 * and "end" instructions denoting the content and boundary of the stream are
 * sent automatically.
 */
public class InputStreamInterceptingFilter
        extends StreamInterceptingFilter<InputStream> {

    /**
     * Logger for this class.
     */
    private static final Logger logger =
            LoggerFactory.getLogger(InputStreamInterceptingFilter.class);

    /**
     * Creates a new InputStreamInterceptingFilter which selectively intercepts
     * "ack" instructions. The required "blob" and "end" instructions will
     * automatically be sent over the given tunnel based on the content of
     * provided InputStreams.
     *
     * @param tunnel
     *     The GuacamoleTunnel over which any required "blob" and "end"
     *     instructions should be sent.
     */
    public InputStreamInterceptingFilter(GuacamoleTunnel tunnel) {
        super(tunnel);
    }

    /**
     * Injects a "blob" instruction into the outbound Guacamole protocol
     * stream, as if sent by the connected client. "blob" instructions are used
     * to send chunks of data along a stream.
     *
     * @param index
     *     The index of the stream that this "blob" instruction relates to.
     *
     * @param blob
     *     The chunk of data to send within the "blob" instruction.
     */
    private void sendBlob(String index, byte[] blob) {

        // Send "blob" containing provided data
        sendInstruction(new GuacamoleInstruction("blob", index,
           BaseEncoding.base64().encode(blob)));

    }

    /**
     * Injects an "end" instruction into the outbound Guacamole protocol
     * stream, as if sent by the connected client. "end" instructions are used
     * to signal the end of a stream.
     *
     * @param index
     *     The index of the stream that this "end" instruction relates to.
     */
    private void sendEnd(String index) {
        sendInstruction(new GuacamoleInstruction("end", index));
    }

    /**
     * Reads the next chunk of data from the InputStream associated with an
     * intercepted stream, sending that data as a "blob" instruction over the
     * GuacamoleTunnel associated with this filter.
     *
     * @param stream
     *     The stream from which the next chunk of data should be read.
     */
    private void readNextBlob(InterceptedStream<InputStream> stream) {

        // Read blob from stream if it exists
        try {

            // Read raw data from input stream
            byte[] blob = new byte[6048];
            int length = stream.getStream().read(blob);

            // End stream if no more data
            if (length == -1) {

                // Close stream
                closeInterceptedStream(stream);

                return;

            }

            // Inject corresponding "blob" instruction
            sendBlob(stream.getIndex(), Arrays.copyOf(blob, length));

        }

        // Terminate stream if it cannot be read
        catch (IOException e) {

            logger.debug("Unable to read data of intercepted input stream.", e);

            // Close stream, send end if the stream is still valid
            if (closeInterceptedStream(stream))
                sendEnd(stream.getIndex());

        }

    }

    /**
     * Handles a single "ack" instruction, sending yet more blobs or closing the
     * stream depending on whether the "ack" indicates success or failure. If no
     * InputStream is associated with the stream index within the "ack"
     * instruction, the instruction is ignored.
     *
     * @param instruction
     *     The "ack" instruction being handled.
     */
    private void handleAck(GuacamoleInstruction instruction) {

        // Verify all required arguments are present
        List<String> args = instruction.getArgs();
        if (args.size() < 3)
            return;

        // Pull associated stream
        String index = args.get(0);
        InterceptedStream<InputStream> stream = getInterceptedStream(index);
        if (stream == null)
            return;

        // Pull status code
        String status = args.get(2);

        // Terminate stream if an error is encountered
        if (!status.equals("0")) {

            // Parse status code as integer
            int code;
            try {
                code = Integer.parseInt(status);
            }

            // Assume internal error if parsing fails
            catch (NumberFormatException e) {
                logger.debug("Translating invalid status code \"{}\" to SERVER_ERROR.", status);
                code = GuacamoleStatus.SERVER_ERROR.getGuacamoleStatusCode();
            }

            // Flag error and close stream
            stream.setStreamError(code, args.get(1));
            closeInterceptedStream(stream);
            return;

        }

        // Send next blob
        readNextBlob(stream);

    }

    @Override
    public GuacamoleInstruction filter(GuacamoleInstruction instruction)
            throws GuacamoleException {

        // Intercept "ack" instructions for in-progress streams
        if (instruction.getOpcode().equals("ack"))
            handleAck(instruction);

        // Pass instruction through untouched
        return instruction;

    }

    @Override
    protected void handleInterceptedStream(InterceptedStream<InputStream> stream) {

        // Read the first blob. Note that future blobs will be read in response
        // to received "ack" instructions.
        readNextBlob(stream);

    }

}
