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
 * Provides abstract socket-like access to a Guacamole connection.
 */
public interface GuacamoleSocket {

    /**
     * Returns the name of the protocol to be used. If the protocol is not
     * known or the implementation refuses to reveal the underlying protocol,
     * null is returned.
     *
     * <p>Implementations <strong>should</strong> aim to expose the name of the
     * underlying protocol, such that protocol-specific responses like the
     * "required" and "argv" instructions can be handled correctly by code
     * consuming the GuacamoleSocket.
     *
     * @return
     *     The name of the protocol to be used, or null if this information is
     *     not available.
     */
    public default String getProtocol() {
        return null;
    }

    /**
     * Returns a GuacamoleReader which can be used to read from the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return A GuacamoleReader which can be used to read from the
     *         Guacamole instruction stream.
     */
    public GuacamoleReader getReader();

    /**
     * Returns a GuacamoleWriter which can be used to write to the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return A GuacamoleWriter which can be used to write to the
     *         Guacamole instruction stream.
     */
    public GuacamoleWriter getWriter();

    /**
     * Releases all resources in use by the connection represented by this
     * GuacamoleSocket.
     *
     * @throws GuacamoleException If an error occurs while releasing resources.
     */
    public void close() throws GuacamoleException;

    /**
     * Returns whether this GuacamoleSocket is open and can be used for reading
     * and writing.
     *
     * @return true if this GuacamoleSocket is open, false otherwise.
     */
    public boolean isOpen();

}
