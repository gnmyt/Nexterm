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

package org.apache.guacamole.servlet;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.io.Writer;
import java.security.SecureRandom;
import java.util.Base64;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleConnectionClosedException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.GuacamoleWriter;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A HttpServlet implementing and abstracting the operations required by the
 * HTTP implementation of the JavaScript Guacamole client's tunnel.
 */
public abstract class GuacamoleHTTPTunnelServlet extends HttpServlet {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(GuacamoleHTTPTunnelServlet.class);

    /**
     * Map of absolutely all active tunnels using HTTP, indexed by tunnel
     * session token.
     */
    private final GuacamoleHTTPTunnelMap tunnels = new GuacamoleHTTPTunnelMap();

    /**
     * The name of the HTTP header that contains the tunnel-specific session
     * token identifying each active and distinct HTTP tunnel connection.
     */
    private static final String TUNNEL_TOKEN_HEADER_NAME = "Guacamole-Tunnel-Token";

    /**
     * The prefix of the query string which denotes a tunnel read operation.
     */
    private static final String READ_PREFIX  = "read:";

    /**
     * The prefix of the query string which denotes a tunnel write operation.
     */
    private static final String WRITE_PREFIX = "write:";

    /**
     * Instance of SecureRandom for generating the session token specific to
     * each distinct HTTP tunnel connection.
     */
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Instance of Base64.Encoder for encoding random session tokens as
     * strings.
     */
    private final Base64.Encoder encoder = Base64.getEncoder();

    /**
     * Generates a new, securely-random session token that may be used to
     * represent the ongoing communication session of a distinct HTTP tunnel
     * connection.
     *
     * @return
     *     A new, securely-random session token.
     */
    protected String generateToken() {
        byte[] bytes = new byte[33];
        secureRandom.nextBytes(bytes);
        return encoder.encodeToString(bytes);
    }

    /**
     * Registers the given tunnel such that future read/write requests to that
     * tunnel will be properly directed.
     *
     * @deprecated
     *     This function has been deprecated in favor of {@link #registerTunnel(java.lang.String, org.apache.guacamole.net.GuacamoleTunnel)},
     *     which decouples identification of HTTP tunnel sessions from the
     *     tunnel UUID.
     *
     * @param tunnel
     *     The tunnel to register.
     */
    @Deprecated
    protected void registerTunnel(GuacamoleTunnel tunnel) {
        registerTunnel(tunnel.getUUID().toString(), tunnel);
    }

    /**
     * Registers the given HTTP tunnel such that future read/write requests
     * including the given tunnel-specific session token will be properly
     * directed. The session token must be unpredictable (securely-random) and
     * unique across all active HTTP tunnels. It is recommended that each HTTP
     * tunnel session token be obtained through calling {@link #generateToken()}.
     *
     * @param tunnelSessionToken
     *     The tunnel-specific session token to associate with the HTTP tunnel
     *     being registered.
     *
     * @param tunnel
     *     The tunnel to register.
     */
    protected void registerTunnel(String tunnelSessionToken, GuacamoleTunnel tunnel) {
        tunnels.put(tunnelSessionToken, tunnel);
        logger.debug("Registered tunnel \"{}\".", tunnel.getUUID());
    }

    /**
     * Deregisters the given tunnel such that future read/write requests to
     * that tunnel will be rejected.
     *
     * @deprecated
     *     This function has been deprecated in favor of {@link #deregisterTunnel(java.lang.String)},
     *     which decouples identification of HTTP tunnel sessions from the
     *     tunnel UUID.
     *
     * @param tunnel
     *     The tunnel to deregister.
     */
    @Deprecated
    protected void deregisterTunnel(GuacamoleTunnel tunnel) {
        deregisterTunnel(tunnel.getUUID().toString());
    }

    /**
     * Deregisters the HTTP tunnel associated with the given tunnel-specific
     * session token such that future read/write requests to that tunnel will
     * be rejected. Each HTTP tunnel must be associated with a session token
     * unique to that tunnel via a call {@link #registerTunnel(java.lang.String, org.apache.guacamole.net.GuacamoleTunnel)}.
     * 
     * @param tunnelSessionToken
     *     The tunnel-specific session token associated with the HTTP tunnel
     *     being deregistered.
     */
    protected void deregisterTunnel(String tunnelSessionToken) {
        GuacamoleTunnel tunnel = tunnels.remove(tunnelSessionToken);
        if (tunnel != null)
            logger.debug("Deregistered tunnel \"{}\".", tunnel.getUUID());
    }

    /**
     * Returns the tunnel associated with the given tunnel-specific session
     * token, if it has been registered with {@link #registerTunnel(java.lang.String, org.apache.guacamole.net.GuacamoleTunnel)}
     * and not yet deregistered with {@link #deregisterTunnel(java.lang.String)}.
     *
     * @param tunnelSessionToken
     *     The tunnel-specific session token associated with the HTTP tunnel to
     *     be retrieved.
     *
     * @return
     *     The tunnel corresponding to the given session token.
     *
     * @throws GuacamoleException
     *     If the requested tunnel does not exist because it has not yet been
     *     registered or it has been deregistered.
     */
    protected GuacamoleTunnel getTunnel(String tunnelSessionToken)
            throws GuacamoleException {

        // Pull tunnel from map
        GuacamoleTunnel tunnel = tunnels.get(tunnelSessionToken);
        if (tunnel == null)
            throw new GuacamoleResourceNotFoundException("No such tunnel.");

        return tunnel;

    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        handleTunnelRequest(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        handleTunnelRequest(request, response);
    }

    /**
     * Sends an error on the given HTTP response using the information within
     * the given GuacamoleStatus.
     *
     * @param response
     *     The HTTP response to use to send the error.
     *
     * @param guacamoleStatusCode
     *     The GuacamoleStatus code to send.
     *
     * @param guacamoleHttpCode
     *     The numeric HTTP code to send.
     *
     * @param message
     *     The human-readable error message to send.
     *
     * @throws ServletException
     *     If an error prevents sending of the error code.
     */
    protected void sendError(HttpServletResponse response, int guacamoleStatusCode,
            int guacamoleHttpCode, String message)
            throws ServletException {

        try {

            // If response not committed, send error code and message
            if (!response.isCommitted()) {
                response.addHeader("Guacamole-Status-Code", Integer.toString(guacamoleStatusCode));
                response.addHeader("Guacamole-Error-Message", message);
                response.sendError(guacamoleHttpCode);
            }

        }
        catch (IOException ioe) {

            // If unable to send error at all due to I/O problems,
            // rethrow as servlet exception
            throw new ServletException(ioe);

        }

    }

    /**
     * Dispatches every HTTP GET and POST request to the appropriate handler
     * function based on the query string.
     *
     * @param request
     *     The HttpServletRequest associated with the GET or POST request
     *     received.
     *
     * @param response
     *     The HttpServletResponse associated with the GET or POST request
     *     received.
     *
     * @throws ServletException
     *     If an error occurs while servicing the request.
     */
    protected void handleTunnelRequest(HttpServletRequest request,
            HttpServletResponse response) throws ServletException {

        try {

            String query = request.getQueryString();
            if (query == null)
                throw new GuacamoleClientException("No query string provided.");

            // If connect operation, call doConnect() and return tunnel
            // session token and UUID in response
            if (query.equals("connect")) {

                GuacamoleTunnel tunnel = doConnect(request);
                if (tunnel == null)
                    throw new GuacamoleResourceNotFoundException("No tunnel created.");

                // Register newly-created tunnel
                String tunnelSessionToken = generateToken();
                registerTunnel(tunnelSessionToken, tunnel);

                try {
                    // Ensure buggy browsers do not cache response
                    response.setHeader("Cache-Control", "no-cache");

                    // Include tunnel session token for future requests
                    response.setHeader(TUNNEL_TOKEN_HEADER_NAME, tunnelSessionToken);
                    
                    // Send UUID to client
                    response.getWriter().print(tunnel.getUUID().toString());
                }
                catch (IOException e) {
                    throw new GuacamoleServerException(e);
                }

                // Connection successful
                return;

            }

            // Pull tunnel-specific session token from request
            String tunnelSessionToken = request.getHeader(TUNNEL_TOKEN_HEADER_NAME);
            if (tunnelSessionToken == null)
                throw new GuacamoleClientException("The HTTP tunnel session "
                        + "token is required for all requests after "
                        + "connecting.");

            // Dispatch valid tunnel read/write operations
            if (query.startsWith(READ_PREFIX))
                doRead(request, response, tunnelSessionToken);
            else if (query.startsWith(WRITE_PREFIX))
                doWrite(request, response, tunnelSessionToken);

            // Otherwise, invalid operation
            else
                throw new GuacamoleClientException("Invalid tunnel operation: " + query);

        }

        // Catch any thrown guacamole exception and attempt to pass within the
        // HTTP response, logging each error appropriately.
        catch (GuacamoleClientException e) {
            logger.warn("HTTP tunnel request rejected: {}", e.getMessage());
            sendError(response, e.getStatus().getGuacamoleStatusCode(),
                    e.getStatus().getHttpStatusCode(), e.getMessage());
        }
        catch (GuacamoleException e) {
            logger.error("HTTP tunnel request failed: {}", e.getMessage());
            logger.debug("Internal error in HTTP tunnel.", e);
            sendError(response, e.getStatus().getGuacamoleStatusCode(),
                    e.getStatus().getHttpStatusCode(), "Internal server error.");
        }

    }

    /**
     * Called whenever the JavaScript Guacamole client makes a connection
     * request via HTTP. It it up to the implementor of this function to define
     * what conditions must be met for a tunnel to be configured and returned
     * as a result of this connection request (whether some sort of credentials
     * must be specified, for example).
     *
     * @param request
     *     The HttpServletRequest associated with the connection request
     *     received. Any parameters specified along with the connection request
     *     can be read from this object.
     *
     * @return
     *     A newly constructed GuacamoleTunnel if successful, null otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while constructing the GuacamoleTunnel, or if the
     *     conditions required for connection are not met.
     */
    protected abstract GuacamoleTunnel doConnect(HttpServletRequest request)
            throws GuacamoleException;

    /**
     * Called whenever the JavaScript Guacamole client makes a read request.
     * This function should in general not be overridden, as it already
     * contains a proper implementation of the read operation.
     *
     * @param request
     *     The HttpServletRequest associated with the read request received.
     *
     * @param response
     *     The HttpServletResponse associated with the write request received.
     *     Any data to be sent to the client in response to the write request
     *     should be written to the response body of this HttpServletResponse.
     *
     * @param tunnelSessionToken
     *     The tunnel-specific session token of the HTTP tunnel to read from,
     *     as specified in the read request. This tunnel must have been created
     *     by a previous call to doConnect().
     *
     * @throws GuacamoleException
     *     If an error occurs while handling the read request.
     */
    protected void doRead(HttpServletRequest request,
            HttpServletResponse response, String tunnelSessionToken)
            throws GuacamoleException {

        // Get tunnel, ensure tunnel exists
        GuacamoleTunnel tunnel = getTunnel(tunnelSessionToken);

        // Ensure tunnel is open
        if (!tunnel.isOpen())
            throw new GuacamoleResourceNotFoundException("Tunnel is closed.");

        // Obtain exclusive read access
        GuacamoleReader reader = tunnel.acquireReader();

        try {

            // Note that although we are sending text, Webkit browsers will
            // buffer 1024 bytes before starting a normal stream if we use
            // anything but application/octet-stream.
            response.setContentType("application/octet-stream");
            response.setHeader("Cache-Control", "no-cache");

            // Get writer for response
            Writer out = new BufferedWriter(new OutputStreamWriter(
                    response.getOutputStream(), "UTF-8"));

            // Stream data to response, ensuring output stream is closed
            try {

                // Deregister tunnel and throw error if we reach EOF without
                // having ever sent any data
                char[] message = reader.read();
                if (message == null)
                    throw new GuacamoleConnectionClosedException("Tunnel reached end of stream.");

                // For all messages, until another stream is ready (we send at least one message)
                do {

                    // Get message output bytes
                    out.write(message, 0, message.length);

                    // Flush if we expect to wait
                    if (!reader.available()) {
                        out.flush();
                        response.flushBuffer();
                    }

                    // No more messages another stream can take over
                    if (tunnel.hasQueuedReaderThreads())
                        break;

                } while (tunnel.isOpen() && (message = reader.read()) != null);

                // Close tunnel immediately upon EOF
                if (message == null) {
                    deregisterTunnel(tunnelSessionToken);
                    tunnel.close();
                }

                // End-of-instructions marker
                out.write("0.;");
                out.flush();
                response.flushBuffer();
            }

            // Send end-of-stream marker and close tunnel if connection is closed
            catch (GuacamoleConnectionClosedException e) {

                // Deregister and close
                deregisterTunnel(tunnelSessionToken);
                tunnel.close();

                // End-of-instructions marker
                out.write("0.;");
                out.flush();
                response.flushBuffer();

            }

            catch (GuacamoleException e) {

                // Deregister and close
                deregisterTunnel(tunnelSessionToken);
                tunnel.close();

                throw e;
            }

            // Always close output stream
            finally {
                out.close();
            }

        }
        catch (IOException e) {

            // Log typically frequent I/O error if desired
            logger.debug("Error writing to servlet output stream", e);

            // Deregister and close
            deregisterTunnel(tunnelSessionToken);
            tunnel.close();

        }
        finally {
            tunnel.releaseReader();
        }

    }

    /**
     * Called whenever the JavaScript Guacamole client makes a write request.
     * This function should in general not be overridden, as it already
     * contains a proper implementation of the write operation.
     *
     * @param request
     *     The HttpServletRequest associated with the write request received.
     *     Any data to be written will be specified within the body of this
     *     request.
     *
     * @param response
     *     The HttpServletResponse associated with the write request received.
     *
     * @param tunnelSessionToken
     *     The tunnel-specific session token of the HTTP tunnel to write to,
     *     as specified in the write request. This tunnel must have been created
     *     by a previous call to doConnect().
     *
     * @throws GuacamoleException
     *     If an error occurs while handling the write request.
     */
    protected void doWrite(HttpServletRequest request,
            HttpServletResponse response, String tunnelSessionToken)
            throws GuacamoleException {

        GuacamoleTunnel tunnel = getTunnel(tunnelSessionToken);

        // We still need to set the content type to avoid the default of
        // text/html, as such a content type would cause some browsers to
        // attempt to parse the result, even though the JavaScript client
        // does not explicitly request such parsing.
        response.setContentType("application/octet-stream");
        response.setHeader("Cache-Control", "no-cache");
        response.setContentLength(0);

        // Send data
        try {

            // Get writer from tunnel
            GuacamoleWriter writer = tunnel.acquireWriter();

            // Get input reader for HTTP stream
            Reader input = new InputStreamReader(
                    request.getInputStream(), "UTF-8");

            // Transfer data from input stream to tunnel output, ensuring
            // input is always closed
            try {

                // Buffer
                int length;
                char[] buffer = new char[8192];

                // Transfer data using buffer
                while (tunnel.isOpen() &&
                        (length = input.read(buffer, 0, buffer.length)) != -1)
                    writer.write(buffer, 0, length);

            }

            // Close input stream in all cases
            finally {
                input.close();
            }

        }
        catch (GuacamoleConnectionClosedException e) {
            logger.debug("Connection to guacd closed.", e);
        }
        catch (IOException e) {

            // Deregister and close
            deregisterTunnel(tunnelSessionToken);
            tunnel.close();

            throw new GuacamoleServerException("I/O Error sending data to server: " + e.getMessage(), e);
        }
        finally {
            tunnel.releaseWriter();
        }

    }

    @Override
    public void destroy() {
        tunnels.shutdown();
    }

}

/**
 * \example ExampleTunnelServlet.java
 *
 * A basic example demonstrating extending GuacamoleTunnelServlet and
 * implementing doConnect() to configure the Guacamole connection as
 * desired.
 */

