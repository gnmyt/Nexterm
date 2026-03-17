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

package org.apache.guacamole.net;


import java.util.concurrent.locks.ReentrantLock;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;

/**
 * Base GuacamoleTunnel implementation which synchronizes access to the
 * underlying reader and writer with reentrant locks. Implementations need only
 * provide the tunnel's UUID and socket.
 */
public abstract class AbstractGuacamoleTunnel implements GuacamoleTunnel {

    /**
     * Lock acquired when a read operation is in progress.
     */
    private final ReentrantLock readerLock;

    /**
     * Lock acquired when a write operation is in progress.
     */
    private final ReentrantLock writerLock;

    /**
     * Creates a new GuacamoleTunnel which synchronizes access to the
     * Guacamole instruction stream associated with the underlying
     * GuacamoleSocket.
     */
    public AbstractGuacamoleTunnel() {
        readerLock = new ReentrantLock();
        writerLock = new ReentrantLock();
    }

    /**
     * Acquires exclusive read access to the Guacamole instruction stream
     * and returns a GuacamoleReader for reading from that stream.
     *
     * @return A GuacamoleReader for reading from the Guacamole instruction
     *         stream.
     */
    @Override
    public GuacamoleReader acquireReader() {
        readerLock.lock();
        return getSocket().getReader();
    }

    /**
     * Relinquishes exclusive read access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleReader.
     */
    @Override
    public void releaseReader() {
        readerLock.unlock();
    }

    /**
     * Returns whether there are threads waiting for read access to the
     * Guacamole instruction stream.
     *
     * @return true if threads are waiting for read access the Guacamole
     *         instruction stream, false otherwise.
     */
    @Override
    public boolean hasQueuedReaderThreads() {
        return readerLock.hasQueuedThreads();
    }

    /**
     * Acquires exclusive write access to the Guacamole instruction stream
     * and returns a GuacamoleWriter for writing to that stream.
     *
     * @return A GuacamoleWriter for writing to the Guacamole instruction
     *         stream.
     */
    @Override
    public GuacamoleWriter acquireWriter() {
        writerLock.lock();
        return getSocket().getWriter();
    }

    /**
     * Relinquishes exclusive write access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleWriter.
     */
    @Override
    public void releaseWriter() {
        writerLock.unlock();
    }

    @Override
    public boolean hasQueuedWriterThreads() {
        return writerLock.hasQueuedThreads();
    }

    @Override
    public void close() throws GuacamoleException {
        getSocket().close();
    }

    @Override
    public boolean isOpen() {
        return getSocket().isOpen();
    }

}
