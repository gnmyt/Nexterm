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

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;

/**
 * GuacamoleSocket implementation which simply delegates all function calls to
 * an underlying GuacamoleSocket.
 */
public class DelegatingGuacamoleSocket implements GuacamoleSocket {

    /**
     * The wrapped socket.
     */
    private final GuacamoleSocket socket;

    /**
     * Wraps the given GuacamoleSocket such that all function calls against
     * this DelegatingGuacamoleSocket will be delegated to it.
     *
     * @param socket
     *     The GuacamoleSocket to wrap.
     */
    public DelegatingGuacamoleSocket(GuacamoleSocket socket) {
        this.socket = socket;
    }

    /**
     * Returns the underlying GuacamoleSocket wrapped by this
     * DelegatingGuacamoleSocket.
     *
     * @return
     *     The GuacamoleSocket wrapped by this DelegatingGuacamoleSocket.
     */
    protected GuacamoleSocket getDelegateSocket() {
        return socket;
    }

    @Override
    public String getProtocol() {
        return socket.getProtocol();
    }

    @Override
    public GuacamoleReader getReader() {
        return socket.getReader();
    }

    @Override
    public GuacamoleWriter getWriter() {
        return socket.getWriter();
    }

    @Override
    public void close() throws GuacamoleException {
        socket.close();
    }

    @Override
    public boolean isOpen() {
        return socket.isOpen();
    }

}
