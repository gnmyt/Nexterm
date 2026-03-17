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
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Map-like storage for intercepted Guacamole streams.
 *
 * @param <T>
 *     The type of object which will produce or consume the data sent over the
 *     intercepted Guacamole stream. Usually, this will be either InputStream
 *     or OutputStream.
 */
public class InterceptedStreamMap<T extends Closeable> {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(InterceptedStreamMap.class);

    /**
     * The maximum number of milliseconds to wait for notification that a
     * stream has closed before explicitly checking for closure ourselves.
     */
    private static final long STREAM_WAIT_TIMEOUT = 1000;

    /**
     * Mapping of the indexes of all streams whose associated "blob" and "end"
     * instructions should be intercepted.
     */
    private final ConcurrentMap<String, InterceptedStream<T>> streams =
            new ConcurrentHashMap<String, InterceptedStream<T>>();

    /**
     * Closes the given stream, logging any errors that occur during closure.
     * The monitor of the stream is notified via a single call to notify() once
     * the attempt to close has been made.
     *
     * @param stream
     *     The stream to close and notify.
     */
    private void close(T stream) {

        // Attempt to close stream
        try {
            stream.close();
        }
        catch (IOException e) {
            logger.warn("Unable to close intercepted stream: {}", e.getMessage());
            logger.debug("I/O error prevented closure of intercepted stream.", e);
        }

        // Notify waiting threads that the stream has ended
        synchronized (stream) {
            stream.notify();
        }

    }

    /**
     * Closes the stream object associated with the stream having the given
     * index, if any, removing it from the map, logging any errors that occur
     * during closure, and unblocking any in-progress calls to waitFor() for
     * that stream. If no such stream exists within this map, then this
     * function has no effect.
     *
     * @param index
     *     The index of the stream whose associated stream object should be
     *     closed.
     *
     * @return
     *     The stream associated with the given index, if the stream was stored
     *     within this map, or null if no such stream exists.
     */
    public InterceptedStream<T> close(String index) {

        // Remove associated stream
        InterceptedStream<T> stream = streams.remove(index);
        if (stream == null)
            return null;

        // Close stream if it exists
        close(stream.getStream());
        return stream;

    }

    /**
     * Closes the given stream, logging any errors that occur during closure,
     * and unblocking any in-progress calls to waitFor() for the given stream.
     * If the given stream is stored within this map, it will also be removed.
     *
     * @param stream
     *     The stream to close.
     *
     * @return
     *     true if the given stream was stored within this map, false
     *     otherwise.
     */
    public boolean close(InterceptedStream<T> stream) {

        // Remove stream if present
        boolean wasRemoved = streams.remove(stream.getIndex(), stream);

        // Close provided stream
        close(stream.getStream());

        return wasRemoved;

    }

    /**
     * Removes and closes all streams stored within this map, logging any errors
     * that occur during closure, and unblocking any in-progress calls to
     * waitFor().
     */
    public void closeAll() {

        // Close any active streams
        for (InterceptedStream<T> stream : streams.values())
            close(stream.getStream());

        // Remove now-useless references
        streams.clear();

    }

    /**
     * Blocks until the given stream is closed, or until another stream with
     * the same index replaces it.
     *
     * @param stream
     *     The stream to wait for.
     */
    public void waitFor(InterceptedStream<T> stream) {

        T underlyingStream = stream.getStream();

        // Wait for stream to close
        synchronized (underlyingStream) {
            while (streams.get(stream.getIndex()) == stream) {
                try {
                    underlyingStream.wait(STREAM_WAIT_TIMEOUT);
                }
                catch (InterruptedException e) {
                    // Ignore
                }
            }
        }

    }

    /**
     * Returns the stream stored in this map under the given index.
     *
     * @param index
     *     The index of the stream to return.
     *
     * @return
     *     The stream having the given index, or null if no such stream is
     *     stored within this map.
     */
    public InterceptedStream<T> get(String index) {
        return streams.get(index);
    }

    /**
     * Adds the given stream to this map, storing it under its associated
     * index. If another stream already exists within this map having the same
     * index, that stream will be closed and replaced.
     *
     * @param stream
     *     The stream to store within this map.
     */
    public void put(InterceptedStream<T> stream) {

        // Add given stream to map
        InterceptedStream<T> oldStream =
                streams.put(stream.getIndex(), stream);

        // If a previous stream DID exist, close it
        if (oldStream != null)
            close(oldStream.getStream());

    }

}
