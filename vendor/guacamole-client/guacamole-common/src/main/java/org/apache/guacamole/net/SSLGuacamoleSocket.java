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


import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import javax.net.SocketFactory;
import javax.net.ssl.SSLSocketFactory;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.io.ReaderGuacamoleReader;
import org.apache.guacamole.io.WriterGuacamoleWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provides abstract socket-like access to a Guacamole connection over SSL to
 * a given hostname and port.
 */
public class SSLGuacamoleSocket implements GuacamoleSocket {

    /**
     * Logger for this class.
     */
    private Logger logger = LoggerFactory.getLogger(SSLGuacamoleSocket.class);

    /**
     * The GuacamoleReader this socket should read from.
     */
    private GuacamoleReader reader;

    /**
     * The GuacamoleWriter this socket should write to.
     */
    private GuacamoleWriter writer;

    /**
     * The number of milliseconds to wait for data on the TCP socket before
     * timing out.
     */
    private static final int SOCKET_TIMEOUT = 15000;

    /**
     * The TCP socket that the GuacamoleReader and GuacamoleWriter exposed
     * by this class should affect.
     */
    private Socket sock;

    /**
     * Creates a new SSLGuacamoleSocket which reads and writes instructions
     * to the Guacamole instruction stream of the Guacamole proxy server
     * running at the given hostname and port using SSL.
     *
     * @param hostname The hostname of the Guacamole proxy server to connect to.
     * @param port The port of the Guacamole proxy server to connect to.
     * @throws GuacamoleException If an error occurs while connecting to the
     *                            Guacamole proxy server.
     */
    public SSLGuacamoleSocket(String hostname, int port) throws GuacamoleException {

        // Get factory for SSL sockets
        SocketFactory socket_factory = SSLSocketFactory.getDefault();
        
        try {

            logger.debug("Connecting to guacd at {}:{} via SSL/TLS.",
                    hostname, port);

            // Get address
            SocketAddress address = new InetSocketAddress(
                InetAddress.getByName(hostname),
                port
            );

            // Connect with timeout
            sock = socket_factory.createSocket();
            sock.connect(address, SOCKET_TIMEOUT);

            // Set read timeout
            sock.setSoTimeout(SOCKET_TIMEOUT);

            // On successful connect, retrieve I/O streams
            reader = new ReaderGuacamoleReader(new InputStreamReader(sock.getInputStream(),   "UTF-8"));
            writer = new WriterGuacamoleWriter(new OutputStreamWriter(sock.getOutputStream(), "UTF-8"));

        }
        catch (IOException e) {
            throw new GuacamoleServerException(e);
        }

    }

    @Override
    public void close() throws GuacamoleException {
        try {
            logger.debug("Closing socket to guacd.");
            sock.close();
        }
        catch (IOException e) {
            throw new GuacamoleServerException(e);
        }
    }

    @Override
    public GuacamoleReader getReader() {
        return reader;
    }

    @Override
    public GuacamoleWriter getWriter() {
        return writer;
    }

    @Override
    public boolean isOpen() {
        return !sock.isClosed();
    }

}
