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

package org.apache.guacamole.tunnel.websocket.jetty8;

import java.io.IOException;
import java.util.List;
import javax.servlet.http.HttpServletRequest;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.eclipse.jetty.websocket.WebSocket;
import org.eclipse.jetty.websocket.WebSocket.Connection;
import org.eclipse.jetty.websocket.WebSocketServlet;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleConnectionClosedException;
import org.apache.guacamole.protocol.FilteredGuacamoleWriter;
import org.apache.guacamole.protocol.GuacamoleFilter;
import org.apache.guacamole.protocol.GuacamoleInstruction;
import org.apache.guacamole.tunnel.http.HTTPTunnelRequest;
import org.apache.guacamole.tunnel.TunnelRequest;
import org.apache.guacamole.protocol.GuacamoleStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A WebSocketServlet partial re-implementation of GuacamoleTunnelServlet.
 */
public abstract class GuacamoleWebSocketTunnelServlet extends WebSocketServlet {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(GuacamoleWebSocketTunnelServlet.class);
    
    /**
     * The default, minimum buffer size for instructions.
     */
    private static final int BUFFER_SIZE = 8192;

    /**
     * The opcode of the instruction used to indicate a connection stability
     * test ping request or response. Note that this instruction is
     * encapsulated within an internal tunnel instruction (with the opcode
     * being the empty string), thus this will actually be the value of the
     * first element of the received instruction.
     */
    private static final String PING_OPCODE = "ping";

    /**
     * Sends the given numeric Guacamole and WebSocket status
     * on the given WebSocket connection and closes the
     * connection.
     *
     * @param connection
     *     The WebSocket connection to close.
     *
     * @param guacamoleStatusCode
     *     The numeric Guacamole Status code to send.
     *
     * @param webSocketCode
     *     The numeric WebSocket status code to send.
     */
    private static void closeConnection(Connection connection,
            int guacamoleStatusCode, int webSocketCode) {

        connection.close(webSocketCode,
                Integer.toString(guacamoleStatusCode));

    }

    /**
     * Sends the given status on the given WebSocket connection
     * and closes the connection.
     *
     * @param connection
     *     The WebSocket connection to close.
     *
     * @param guacStatus
     *     The status to send.
     */
    private static void closeConnection(Connection connection,
            GuacamoleStatus guacStatus) {

        closeConnection(connection, guacStatus.getGuacamoleStatusCode(),
                guacStatus.getWebSocketCode());

    }

    @Override
    public WebSocket doWebSocketConnect(HttpServletRequest request, String protocol) {

        final TunnelRequest tunnelRequest = new HTTPTunnelRequest(request);

        // Return new WebSocket which communicates through tunnel
        return new WebSocket.OnTextMessage() {

            /**
             * The GuacamoleTunnel associated with the connected WebSocket. If
             * the WebSocket has not yet been connected, this will be null.
             */
            private GuacamoleTunnel tunnel = null;

            /**
             * The active WebSocket connection. This value will always be
             * non-null if tunnel is non-null.
             */
            private Connection connection = null;

            /**
             * Sends a Guacamole instruction along the outbound WebSocket
             * connection to the connected Guacamole client. If an instruction
             * is already in the process of being sent by another thread, this
             * function will block until in-progress instructions are complete.
             *
             * @param instruction
             *     The instruction to send.
             *
             * @throws IOException
             *     If an I/O error occurs preventing the given instruction from
             *     being sent.
             */
            private void sendInstruction(String instruction)
                    throws IOException {

                // NOTE: Synchronization on the non-final remote field here is
                // intentional. The outbound websocket connection is only
                // sensitive to simultaneous attempts to send messages with
                // respect to itself. If the connection changes, then
                // synchronization need only be performed in context of the new
                // connection
                synchronized (connection) {
                    connection.sendMessage(instruction);
                }

            }

            /**
             * Sends a Guacamole instruction along the outbound WebSocket
             * connection to the connected Guacamole client. If an instruction
             * is already in the process of being sent by another thread, this
             * function will block until in-progress instructions are complete.
             *
             * @param instruction
             *     The instruction to send.
             *
             * @throws IOException
             *     If an I/O error occurs preventing the given instruction from being
             *     sent.
             */
            private void sendInstruction(GuacamoleInstruction instruction)
                    throws IOException {
                sendInstruction(instruction.toString());
            }

            @Override
            public void onMessage(String string) {

                // Ignore inbound messages if there is no associated tunnel
                if (tunnel == null)
                    return;

                // Filter received instructions, handling tunnel-internal
                // instructions without passing through to guacd
                GuacamoleWriter writer = new FilteredGuacamoleWriter(tunnel.acquireWriter(), new GuacamoleFilter() {

                    @Override
                    public GuacamoleInstruction filter(GuacamoleInstruction instruction)
                            throws GuacamoleException {

                        // Filter out all tunnel-internal instructions
                        if (instruction.getOpcode().equals(GuacamoleTunnel.INTERNAL_DATA_OPCODE)) {

                            // Respond to ping requests
                            List<String> args = instruction.getArgs();
                            if (args.size() >= 2 && args.get(0).equals(PING_OPCODE)) {

                                try {
                                    sendInstruction(new GuacamoleInstruction(
                                        GuacamoleTunnel.INTERNAL_DATA_OPCODE,
                                        PING_OPCODE, args.get(1)
                                    ));
                                }
                                catch (IOException e) {
                                    logger.debug("Unable to send \"ping\" response for WebSocket tunnel.", e);
                                }

                            }

                            return null;

                        }

                        // Pass through all non-internal instructions untouched
                        return instruction;

                    }

                });

                // Write message received
                try {
                    writer.write(string.toCharArray());
                }
                catch (GuacamoleConnectionClosedException e) {
                    logger.debug("Connection to guacd closed.", e);
                }
                catch (GuacamoleException e) {
                    logger.debug("WebSocket tunnel write failed.", e);
                }

                tunnel.releaseWriter();

            }

            @Override
            public void onOpen(final Connection connection) {

                // Store websocket connection for future use via sendInstruction()
                this.connection = connection;

                try {
                    tunnel = doConnect(tunnelRequest);
                }
                catch (GuacamoleException e) {
                    logger.error("Creation of WebSocket tunnel to guacd failed: {}", e.getMessage());
                    logger.debug("Error connecting WebSocket tunnel.", e);
                    closeConnection(connection, e.getStatus().getGuacamoleStatusCode(),
                            e.getWebSocketCode());
                    return;
                }

                // Do not start connection if tunnel does not exist
                if (tunnel == null) {
                    closeConnection(connection, GuacamoleStatus.RESOURCE_NOT_FOUND);
                    return;
                }

                Thread readThread = new Thread() {

                    @Override
                    public void run() {

                        StringBuilder buffer = new StringBuilder(BUFFER_SIZE);
                        GuacamoleReader reader = tunnel.acquireReader();
                        char[] readMessage;

                        try {

                            // Send tunnel UUID
                            sendInstruction(new GuacamoleInstruction(
                                GuacamoleTunnel.INTERNAL_DATA_OPCODE,
                                tunnel.getUUID().toString()
                            ));

                            try {

                                // Attempt to read
                                while ((readMessage = reader.read()) != null) {

                                    // Buffer message
                                    buffer.append(readMessage);

                                    // Flush if we expect to wait or buffer is getting full
                                    if (!reader.available() || buffer.length() >= BUFFER_SIZE) {
                                        sendInstruction(buffer.toString());
                                        buffer.setLength(0);
                                    }

                                }

                                // No more data
                                closeConnection(connection, GuacamoleStatus.SUCCESS);
                                
                            }

                            // Catch any thrown guacamole exception and attempt
                            // to pass within the WebSocket connection, logging
                            // each error appropriately.
                            catch (GuacamoleClientException e) {
                                logger.info("WebSocket connection terminated: {}", e.getMessage());
                                logger.debug("WebSocket connection terminated due to client error.", e);
                                closeConnection(connection, e.getStatus().getGuacamoleStatusCode(),
                                        e.getWebSocketCode());
                            }
                            catch (GuacamoleConnectionClosedException e) {
                                logger.debug("Connection to guacd closed.", e);
                                closeConnection(connection, GuacamoleStatus.SUCCESS);
                            }
                            catch (GuacamoleException e) {
                                logger.error("Connection to guacd terminated abnormally: {}", e.getMessage());
                                logger.debug("Internal error during connection to guacd.", e);
                                closeConnection(connection, e.getStatus().getGuacamoleStatusCode(),
                                        e.getWebSocketCode());
                            }

                        }
                        catch (IOException e) {
                            logger.debug("WebSocket tunnel read failed due to I/O error.", e);
                            closeConnection(connection, GuacamoleStatus.SERVER_ERROR);
                        }

                    }

                };

                readThread.start();

            }

            @Override
            public void onClose(int i, String string) {
                try {
                    if (tunnel != null)
                        tunnel.close();
                }
                catch (GuacamoleException e) {
                    logger.debug("Unable to close connection to guacd.", e);
                }
            }

        };

    }

    /**
     * Called whenever the JavaScript Guacamole client makes a connection
     * request. It it up to the implementor of this function to define what
     * conditions must be met for a tunnel to be configured and returned as a
     * result of this connection request (whether some sort of credentials must
     * be specified, for example).
     *
     * @param request
     *     The TunnelRequest associated with the connection request received.
     *     Any parameters specified along with the connection request can be
     *     read from this object.
     *
     * @return
     *     A newly constructed GuacamoleTunnel if successful, null otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while constructing the GuacamoleTunnel, or if the
     *     conditions required for connection are not met.
     */
    protected abstract GuacamoleTunnel doConnect(TunnelRequest request)
            throws GuacamoleException;

}

