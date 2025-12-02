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
import org.apache.guacamole.protocol.GuacamoleStatus;

/**
 * A simple pairing of the index of an intercepted Guacamole stream with the
 * stream-type object which will produce or consume the data sent over the
 * intercepted Guacamole stream.
 *
 * @param <T>
 *     The type of object which will produce or consume the data sent over the
 *     intercepted Guacamole stream. Usually, this will be either InputStream
 *     or OutputStream.
 */
public class InterceptedStream<T extends Closeable> {

    /**
     * The index of the Guacamole stream being intercepted.
     */
    private final String index;

    /**
     * The stream which will produce or consume the data sent over the
     * intercepted Guacamole stream.
     */
    private final T stream;

    /**
     * The exception which prevented the stream from completing successfully,
     * if any. If the stream completed successfully, or has not encountered any
     * exception yet, this will be null.
     */
    private GuacamoleException streamError = null;

    /**
     * Creates a new InterceptedStream which associated the given Guacamole
     * stream index with the given stream object.
     *
     * @param index
     *     The index of the Guacamole stream being intercepted.
     *
     * @param stream
     *     The stream which will produce or consume the data sent over the
     *     intercepted Guacamole stream.
     */
    public InterceptedStream(String index, T stream) {
        this.index = index;
        this.stream = stream;
    }

    /**
     * Returns the index of the Guacamole stream being intercepted.
     *
     * @return
     *     The index of the Guacamole stream being intercepted.
     */
    public String getIndex() {
        return index;
    }

    /**
     * Returns the stream which will produce or consume the data sent over the
     * intercepted Guacamole stream.
     *
     * @return
     *     The stream which will produce or consume the data sent over the
     *     intercepted Guacamole stream.
     */
    public T getStream() {
        return stream;
    }

    /**
     * Reports that this InterceptedStream did not complete successfully due to
     * the given GuacamoleException, which could not be thrown at the time due
     * to asynchronous handling of the stream contents.
     *
     * @param streamError
     *     The exception which prevented the stream from completing
     *     successfully.
     */
    public void setStreamError(GuacamoleException streamError) {
        this.streamError = streamError;
    }

    /**
     * Reports that this InterceptedStream did not complete successfully due to
     * an error described by the given status code and human-readable message.
     * The error reported by this call can later be retrieved as a
     * GuacamoleStreamException by calling getStreamError().
     *
     * @param code
     *     The Guacamole protocol status code which described the error that
     *     occurred. This should be taken directly from the "ack" instruction
     *     that reported the error witin the intercepted stream.
     *
     * @param message
     *     A human-readable message describing the error that occurred. This
     *     should be taken directly from the "ack" instruction that reported
     *     the error witin the intercepted stream.
     */
    public void setStreamError(int code, String message) {

        // Map status code to GuacamoleStatus, assuming SERVER_ERROR by default
        GuacamoleStatus status = GuacamoleStatus.fromGuacamoleStatusCode(code);
        if (status == null)
            status = GuacamoleStatus.SERVER_ERROR;

        // Associate stream with corresponding GuacamoleStreamException
        setStreamError(new GuacamoleStreamException(status, message));

    }

    /**
     * Returns whether an error has prevented this InterceptedStream from
     * completing successfully. This will return false if the stream has
     * completed successfully OR if the stream simply has not yet completed.
     *
     * @return
     *     true if an error has prevented this InterceptedStream from
     *     completing successfully, false otherwise.
     */
    public boolean hasStreamError() {
        return streamError != null;
    }

    /**
     * Returns a GuacamoleException which describes why this InterceptedStream
     * did not complete successfully.
     *
     * @return
     *     An exception describing the error that prevented the stream from
     *     completing successfully, or null if no such error has occurred.
     */
    public GuacamoleException getStreamError() {
        return streamError;
    }

}
