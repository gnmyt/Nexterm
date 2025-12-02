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

package org.apache.guacamole.rest;

import java.io.IOException;
import java.io.InputStream;
import org.apache.guacamole.GuacamoleClientOverrunException;

/**
 * InputStream implementation which limits the body of REST API requests to
 * a particular maximum size. If an attempt is made to read from a REST API
 * request which exceeds this limit, the read attempt will be aborted by
 * throwing an APIException.
 */
public class LimitedRequestInputStream extends InputStream {

    /**
     * The InputStream being limited.
     */
    private final InputStream stream;

    /**
     * The maximum number of bytes to allow to be read or skipped.
     */
    private final long maxLength;

    /**
     * The total number of bytes that have been read or skipped from the stream
     * thus far.
     */
    private long bytesRead = 0;

    /**
     * Wraps the given InputStream, ensuring that the overall number of bytes
     * read or skipped does not exceed the given maximum length.
     *
     * @param stream
     *     The InputStream to limit.
     *
     * @param maxLength
     *     The maximum number of bytes to allow to be read or skipped.
     */
    public LimitedRequestInputStream(InputStream stream, long maxLength) {
        this.stream = stream;
        this.maxLength = maxLength;
    }

    /**
     * Immediately verifies that the stream length limit has not been exceeded.
     * If the length limit has been exceeded, an APIException is thrown
     * indicating that the request body is too large.
     *
     * @throws APIException
     *     If the length limit has been exceeded.
     */
    private synchronized void recheckLength() throws APIException {
        if (bytesRead > maxLength)
            throw new APIException(new GuacamoleClientOverrunException("Request body/entity too large."));
    }

    /**
     * Updates the current number of bytes read based on the return value of a
     * read-like operation such as read() or skip(). If the maximum stream
     * length is exceeded as a result of the read, an APIException indicating
     * this is thrown.
     *
     * NOTE: To avoid unnecessary read operations, recheckLength() should be
     * manually called before performing any read operation. This function will
     * perform the same checks, but can inherently only do so AFTER the read
     * operation has occurred.
     *
     * @param change
     *     The number of bytes that have been read or skipped, or -1 if the
     *     read-like operation has failed (and no bytes have been read).
     *
     * @return
     *     The provided number of bytes read/skipped.
     *
     * @throws APIException
     *     If the read-like operation that occurred has caused the stream
     *     length to exceed its maximum.
     */
    private synchronized long limitedRead(long change) throws APIException {

        if (change != -1) {
            bytesRead += change;
            recheckLength();
        }

        return change;

    }

    @Override
    public void close() throws IOException {
        stream.close();
    }

    @Override
    public int available() throws IOException {
        return stream.available();
    }

    @Override
    public long skip(long l) throws IOException {
        recheckLength();
        return limitedRead(stream.skip(l));
    }

    @Override
    public int read(byte[] bytes, int i, int i1) throws IOException {
        recheckLength();
        return (int) limitedRead(stream.read(bytes, i, i1));
    }

    @Override
    public int read(byte[] bytes) throws IOException {
        recheckLength();
        return (int) limitedRead(stream.read(bytes));
    }

    @Override
    public int read() throws IOException {

        recheckLength();

        int value = stream.read();
        if (value != -1)
            limitedRead(1);

        return value;

    }

}
