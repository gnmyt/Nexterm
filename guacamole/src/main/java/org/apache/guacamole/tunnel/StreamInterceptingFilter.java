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

import java.io.Closeable;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleFilter;
import org.apache.guacamole.protocol.GuacamoleInstruction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Filter which selectively intercepts stream-related instructions,
 * automatically writing to, reading from, or closing the stream given with
 * interceptStream(). Any instructions required by the Guacamole protocol to be
 * sent in response to intercepted instructions will be sent automatically.
 *
 * @param <T>
 *     The type of object which will produce or consume the data sent over the
 *     intercepted Guacamole stream. Usually, this will be either InputStream
 *     or OutputStream.
 */
public abstract class StreamInterceptingFilter<T extends Closeable>
        implements GuacamoleFilter {

    /**
     * Logger for this class.
     */
    private static final Logger logger =
            LoggerFactory.getLogger(StreamInterceptingFilter.class);

    /**
     * Mapping of the all streams whose related instructions should be
     * intercepted.
     */
    private final InterceptedStreamMap<T> streams = new InterceptedStreamMap<T>();

    /**
     * The tunnel over which any required instructions should be sent.
     */
    private final GuacamoleTunnel tunnel;

    /**
     * Creates a new StreamInterceptingFilter which selectively intercepts
     * stream-related instructions. Any instructions required by the Guacamole
     * protocol to be sent in response to intercepted instructions will be sent
     * automatically over the given tunnel.
     *
     * @param tunnel
     *     The GuacamoleTunnel over which any required instructions should be
     *     sent.
     */
    public StreamInterceptingFilter(GuacamoleTunnel tunnel) {
        this.tunnel = tunnel;
    }

    /**
     * Injects an arbitrary Guacamole instruction into the outbound Guacamole
     * protocol stream (GuacamoleWriter) of the tunnel associated with this
     * StreamInterceptingFilter, as if the instruction was sent by the connected
     * client.
     *
     * @param instruction
     *     The Guacamole instruction to inject.
     */
    protected void sendInstruction(GuacamoleInstruction instruction) {

        // Temporarily acquire writer to send "ack" instruction
        GuacamoleWriter writer = tunnel.acquireWriter();

        // Send successful "ack"
        try {
            writer.writeInstruction(instruction);
        }
        catch (GuacamoleException e) {
            logger.debug("Unable to send \"{}\" for intercepted stream.",
                    instruction.getOpcode(), e);
        }

        // Done writing
        tunnel.releaseWriter();

    }

    /**
     * Returns the stream having the given index and currently being intercepted
     * by this filter.
     *
     * @param index
     *     The index of the stream to return.
     *
     * @return
     *     The stream having the given index, or null if no such stream is
     *     being intercepted.
     */
    protected InterceptedStream<T> getInterceptedStream(String index) {
        return streams.get(index);
    }

    /**
     * Closes the stream having the given index and currently being intercepted
     * by this filter, if any. If no such stream is being intercepted, then this
     * function has no effect.
     *
     * @param index
     *     The index of the stream to close.
     *
     * @return
     *     The stream associated with the given index, if the stream is being
     *     intercepted, or null if no such stream exists.
     */
    protected InterceptedStream<T> closeInterceptedStream(String index) {
        return streams.close(index);
    }

    /**
     * Closes the given stream.
     *
     * @param stream
     *     The stream to close.
     *
     * @return
     *     true if the given stream was being intercepted, false otherwise.
     */
    protected boolean closeInterceptedStream(InterceptedStream<T> stream) {
        return streams.close(stream);
    }

    /**
     * Closes all streams being intercepted by this filter.
     */
    public void closeAllInterceptedStreams() {
        streams.closeAll();
    }

    /**
     * Begins handling the data of the given intercepted stream. This function
     * will automatically be invoked by interceptStream() for any valid stream.
     * It is not required that this function block until all data is handled;
     * interceptStream() will do this automatically. Implementations are free
     * to use asynchronous approaches to data handling.
     *
     * @param stream
     *     The stream being intercepted.
     */
    protected abstract void handleInterceptedStream(InterceptedStream<T> stream);

    /**
     * Intercept the stream having the given index, producing or consuming its
     * data as appropriate. The given stream object will automatically be closed
     * when the stream ends. If there is no stream having the given index, then
     * the stream object will be closed immediately. This function will block
     * until all data has been handled and the stream is ended.
     *
     * @param index
     *     The index of the stream to intercept.
     *
     * @param stream
     *     The stream object which will produce or consume all data for the
     *     stream having the given index.
     *
     * @throws GuacamoleException
     *     If an error occurs while intercepting the stream, or if the stream
     *     itself reports an error.
     */
    public void interceptStream(int index, T stream) throws GuacamoleException {

        InterceptedStream<T> interceptedStream;
        String indexString = Integer.toString(index);

        // Atomically verify tunnel is open and add the given stream
        synchronized (tunnel) {

            // Do nothing if tunnel is not open
            if (!tunnel.isOpen())
                return;

            // Wrap stream
            interceptedStream = new InterceptedStream<T>(indexString, stream);

            // Replace any existing stream
            streams.put(interceptedStream);

        }

        // Produce/consume all stream data
        handleInterceptedStream(interceptedStream);

        // Wait for stream to close
        streams.waitFor(interceptedStream);

        // Throw any asynchronously-provided exception
        if (interceptedStream.hasStreamError())
            throw interceptedStream.getStreamError();

    }

}
