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

package org.apache.guacamole.websocket;

import java.io.IOException;
import java.util.List;
import javax.websocket.CloseReason;
import javax.websocket.CloseReason.CloseCode;
import javax.websocket.Endpoint;
import javax.websocket.EndpointConfig;
import javax.websocket.MessageHandler;
import javax.websocket.OnClose;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.RemoteEndpoint;
import javax.websocket.Session;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleConnectionClosedException;
import org.apache.guacamole.protocol.FilteredGuacamoleWriter;
import org.apache.guacamole.protocol.GuacamoleFilter;
import org.apache.guacamole.protocol.GuacamoleInstruction;
import org.apache.guacamole.protocol.GuacamoleStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A WebSocket implementation of GuacamoleTunnel functionality, compatible with
 * the Guacamole.WebSocketTunnel object included with the JavaScript API.
 * Messages sent/received are simply chunks of the Guacamole protocol
 * instruction stream.
 */
public abstract class GuacamoleWebSocketTunnelEndpoint extends Endpoint {

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
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(GuacamoleWebSocketTunnelEndpoint.class);

    /**
     * The underlying GuacamoleTunnel. WebSocket reads/writes will be handled
     * as reads/writes to this tunnel. This value may be null if no connection
     * has been established.
     */
    private GuacamoleTunnel tunnel;

    /**
     * Remote (client) side of this connection. This value will always be
     * non-null if tunnel is non-null.
     */
    private RemoteEndpoint.Basic remote;

    /**
     * Sends the numeric Guacaomle Status Code and Web Socket
     * code and closes the connection.
     *
     * @param session
     *     The outbound WebSocket connection to close.
     *
     * @param guacamoleStatusCode
     *     The numeric Guacamole status to send.
     *
     * @param webSocketCode
     *     The numeric WebSocket status to send.
     */
    private void closeConnection(Session session, int guacamoleStatusCode,
            int webSocketCode) {

        try {
            CloseCode code = CloseReason.CloseCodes.getCloseCode(webSocketCode);
            String message = Integer.toString(guacamoleStatusCode);
            session.close(new CloseReason(code, message));
        }
        catch (IOException e) {
            logger.debug("Unable to close WebSocket connection.", e);
        }

    }

    /**
     * Sends the given Guacaomle Status and closes the given
     * connection.
     *
     * @param session
     *     The outbound WebSocket connection to close.
     *
     * @param guacStatus
     *     The status to use for the connection.
     */
    private void closeConnection(Session session, GuacamoleStatus guacStatus) {
        closeConnection(session, guacStatus.getGuacamoleStatusCode(),
                guacStatus.getWebSocketCode());
    }

    /**
     * Sends a Guacamole instruction along the outbound WebSocket connection to
     * the connected Guacamole client. If an instruction is already in the
     * process of being sent by another thread, this function will block until
     * in-progress instructions are complete.
     *
     * @param instruction
     *     The instruction to send.
     *
     * @throws IOException
     *     If an I/O error occurs preventing the given instruction from being
     *     sent.
     */
    private void sendInstruction(String instruction)
            throws IOException {

        // NOTE: Synchronization on the non-final remote field here is
        // intentional. The remote (the outbound websocket connection) is only
        // sensitive to simultaneous attempts to send messages with respect to
        // itself. If the remote changes, then the outbound websocket
        // connection has changed, and synchronization need only be performed
        // in context of the new remote.
        synchronized (remote) {
            remote.sendText(instruction);
        }

    }

    /**
     * Sends a Guacamole instruction along the outbound WebSocket connection to
     * the connected Guacamole client. If an instruction is already in the
     * process of being sent by another thread, this function will block until
     * in-progress instructions are complete.
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

    /**
     * Returns a new tunnel for the given session. How this tunnel is created
     * or retrieved is implementation-dependent.
     *
     * @param session The session associated with the active WebSocket
     *                connection.
     * @param config Configuration information associated with the instance of
     *               the endpoint created for handling this single connection.
     * @return A connected tunnel, or null if no such tunnel exists.
     * @throws GuacamoleException If an error occurs while retrieving the
     *                            tunnel, or if access to the tunnel is denied.
     */
    protected abstract GuacamoleTunnel createTunnel(Session session, EndpointConfig config)
            throws GuacamoleException;

    @Override
    @OnOpen
    public void onOpen(final Session session, EndpointConfig config) {

        // Store underlying remote for future use via sendInstruction()
        remote = session.getBasicRemote();

        try {

            // Get tunnel
            tunnel = createTunnel(session, config);
            if (tunnel == null) {
                closeConnection(session, GuacamoleStatus.RESOURCE_NOT_FOUND);
                return;
            }

        }
        catch (GuacamoleException e) {
            logger.error("Creation of WebSocket tunnel to guacd failed: {}", e.getMessage());
            logger.debug("Error connecting WebSocket tunnel.", e);
            closeConnection(session, e.getStatus().getGuacamoleStatusCode(),
                    e.getWebSocketCode());
            return;
        }

        // Manually register message handler
        session.addMessageHandler(new MessageHandler.Whole<String>() {

            @Override
            public void onMessage(String message) {
                GuacamoleWebSocketTunnelEndpoint.this.onMessage(message);
            }

        });

        // Prepare read transfer thread
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
                        closeConnection(session, GuacamoleStatus.SUCCESS);

                    }

                    // Catch any thrown guacamole exception and attempt
                    // to pass within the WebSocket connection, logging
                    // each error appropriately.
                    catch (GuacamoleClientException e) {
                        logger.info("WebSocket connection terminated: {}", e.getMessage());
                        logger.debug("WebSocket connection terminated due to client error.", e);
                        closeConnection(session, e.getStatus().getGuacamoleStatusCode(),
                                e.getWebSocketCode());
                    }
                    catch (GuacamoleConnectionClosedException e) {
                        logger.debug("Connection to guacd closed.", e);
                        closeConnection(session, GuacamoleStatus.SUCCESS);
                    }
                    catch (GuacamoleException e) {
                        logger.error("Connection to guacd terminated abnormally: {}", e.getMessage());
                        logger.debug("Internal error during connection to guacd.", e);
                        closeConnection(session, e.getStatus().getGuacamoleStatusCode(),
                                e.getWebSocketCode());
                    }

                }
                catch (IOException e) {
                    logger.debug("I/O error prevents further reads.", e);
                    closeConnection(session, GuacamoleStatus.SERVER_ERROR);
                }

            }

        };

        readThread.start();

    }

    @OnMessage
    public void onMessage(String message) {

        // Ignore inbound messages if there is no associated tunnel
        if (tunnel == null)
            return;

        // Filter received instructions, handling tunnel-internal instructions
        // without passing through to guacd
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

        try {
            // Write received message
            writer.write(message.toCharArray());
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
    @OnClose
    public void onClose(Session session, CloseReason closeReason) {

        try {
            if (tunnel != null)
                tunnel.close();
        }
        catch (GuacamoleException e) {
            logger.debug("Unable to close WebSocket tunnel.", e);
        }
        
    }

}

