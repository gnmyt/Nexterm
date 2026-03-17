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

package org.apache.guacamole.net.auth.simple;

import java.util.Collections;
import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.net.SSLGuacamoleSocket;
import org.apache.guacamole.net.SimpleGuacamoleTunnel;
import org.apache.guacamole.net.auth.AbstractConnection;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.GuacamoleProxyConfiguration;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.token.TokenFilter;

/**
 * A Connection implementation which establishes the underlying connection to
 * guacd using the configuration information provided in guacamole.properties.
 * Parameter tokens provided to connect() are automatically applied if
 * explicitly requested. Tracking of active connections and connection history
 * is not provided.
 */
public class SimpleConnection extends AbstractConnection {

    /**
     * Backing configuration, containing all sensitive information.
     */
    private GuacamoleConfiguration fullConfig;
    
    /**
     * The proxy configuration describing how to connect to guacd.
     */
    private GuacamoleProxyConfiguration proxyConfig;

    /**
     * Whether parameter tokens in the underlying GuacamoleConfiguration should
     * be automatically applied upon connecting. If false, parameter tokens
     * will not be interpreted at all.
     */
    private final boolean interpretTokens;

    /**
     * The tokens which should apply strictly to the next call to
     * {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation)}.
     * This storage is intended as a temporary bridge allowing the old version
     * of connect() to be overridden while still resulting in the same behavior
     * as older versions of SimpleConnection. <strong>This storage should be
     * removed once support for the old, deprecated connect() is removed.</strong>
     */
    private final ThreadLocal<Map<String, String>> currentTokens =
            new ThreadLocal<Map<String, String>>() {

        @Override
        protected Map<String, String> initialValue() {
            return Collections.emptyMap();
        }

    };

    /**
     * Creates a completely uninitialized SimpleConnection. The name,
     * identifier, and configuration of this SimpleConnection must eventually
     * be set before the SimpleConnection may be used. Parameter tokens within
     * the GuacamoleConfiguration eventually supplied with
     * {@link #setConfiguration(org.apache.guacamole.protocol.GuacamoleConfiguration)}
     * will not be interpreted.
     */
    public SimpleConnection() {
        this(false);
    }

    /**
     * Creates a completely uninitialized SimpleConnection. The name,
     * identifier, and configuration of this SimpleConnection must eventually
     * be set before the SimpleConnection may be used. Parameter tokens within
     * the GuacamoleConfiguration eventually supplied with
     * {@link #setConfiguration(org.apache.guacamole.protocol.GuacamoleConfiguration)}
     * will not be interpreted unless explicitly requested.
     *
     * @param interpretTokens
     *     Whether parameter tokens in the underlying GuacamoleConfiguration
     *     should be automatically applied upon connecting. If false, parameter
     *     tokens will not be interpreted at all.
     */
    public SimpleConnection(boolean interpretTokens) {
        this.interpretTokens = interpretTokens;
    }

    /**
     * Creates a new SimpleConnection having the given identifier and
     * GuacamoleConfiguration. Parameter tokens within the
     * GuacamoleConfiguration will not be interpreted unless explicitly
     * requested.
     *
     * @param name
     *     The name to associate with this connection.
     *
     * @param identifier
     *     The identifier to associate with this connection.
     *
     * @param config
     *     The configuration describing how to connect to this connection.
     */
    public SimpleConnection(String name, String identifier,
            GuacamoleConfiguration config) {
        this(name, identifier, config, false);
    }

    /**
     * Creates a new SimpleConnection having the given identifier and
     * GuacamoleConfiguration. Parameter tokens will be interpreted if
     * explicitly requested.
     *
     * @param name
     *     The name to associate with this connection.
     *
     * @param identifier
     *     The identifier to associate with this connection.
     *
     * @param config
     *     The configuration describing how to connect to this connection.
     *
     * @param interpretTokens
     *     Whether parameter tokens in the underlying GuacamoleConfiguration
     *     should be automatically applied upon connecting. If false, parameter
     *     tokens will not be interpreted at all.
     */
    public SimpleConnection(String name, String identifier,
            GuacamoleConfiguration config, boolean interpretTokens) {

        super.setName(name);
        super.setIdentifier(identifier);
        super.setConfiguration(config);

        this.fullConfig = config;
        this.interpretTokens = interpretTokens;

    }
    
    /**
     * Creates a new SimpleConnection having the given identifier,
     * GuacamoleConfiguration, and GuacamoleProxyConfiguration. Parameter tokens
     * will be interpreted if explicitly requested.
     *
     * @param name
     *     The name to associate with this connection.
     *
     * @param identifier
     *     The identifier to associate with this connection.
     * 
     * @param proxyConfig
     *     The Guacamole proxy configuration describing how the connection to
     *     guacd should be established, or null if the default settings will be
     *     used.
     *
     * @param config
     *     The configuration describing how to connect to this connection.
     *
     * @param interpretTokens
     *     Whether parameter tokens in the underlying GuacamoleConfiguration
     *     should be automatically applied upon connecting. If false, parameter
     *     tokens will not be interpreted at all.
     */
    public SimpleConnection(String name, String identifier,
            GuacamoleProxyConfiguration proxyConfig,
            GuacamoleConfiguration config, boolean interpretTokens) {

        this(name, identifier, config, interpretTokens);
        this.proxyConfig = proxyConfig;

    }

    /**
     * Returns the GuacamoleConfiguration describing how to connect to this
     * connection. Unlike {@link #getConfiguration()}, which is allowed to omit
     * or tokenize information, the GuacamoleConfiguration returned by this
     * function will always be the full configuration to be used to establish
     * the connection, as provided when this SimpleConnection was created or via
     * {@link #setConfiguration(org.apache.guacamole.protocol.GuacamoleConfiguration)}.
     *
     * @return
     *     The full GuacamoleConfiguration describing how to connect to this
     *     connection, without any information omitted or tokenized.
     */
    protected GuacamoleConfiguration getFullConfiguration() {
        return fullConfig;
    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {
        super.setConfiguration(config);
        this.fullConfig = config;
    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - there are no attributes
    }

    @Override
    @Deprecated
    public GuacamoleTunnel connect(GuacamoleClientInformation info)
            throws GuacamoleException {

        // Retrieve proxy configuration from environment if we don't have one
        if (proxyConfig == null)
            proxyConfig = LocalEnvironment.getInstance().getDefaultGuacamoleProxyConfiguration();

        // Get guacd connection parameters
        String hostname = proxyConfig.getHostname();
        int port = proxyConfig.getPort();

        // Apply tokens to config parameters
        GuacamoleConfiguration filteredConfig = new GuacamoleConfiguration(getFullConfiguration());
        new TokenFilter(currentTokens.get()).filterValues(filteredConfig.getParameters());

        GuacamoleSocket socket;

        // Determine socket type based on required encryption method
        switch (proxyConfig.getEncryptionMethod()) {

            // If guacd requires SSL, use it
            case SSL:
                socket = new ConfiguredGuacamoleSocket(
                    new SSLGuacamoleSocket(hostname, port),
                    filteredConfig, info
                );
                break;

            // Connect directly via TCP if encryption is not enabled
            case NONE:
                socket = new ConfiguredGuacamoleSocket(
                    new InetGuacamoleSocket(hostname, port),
                    filteredConfig, info
                );
                break;

            // Abort if encryption method is unknown
            default:
                throw new GuacamoleServerException("Unimplemented encryption method.");

        }

        return new SimpleGuacamoleTunnel(socket);

    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation will connect using the GuacamoleConfiguration
     * returned by {@link #getFullConfiguration()}, honoring the
     * "guacd-hostname", "guacd-port", and "guacd-ssl" properties set within
     * guacamole.properties. Parameter tokens will be taken into account if
     * the SimpleConnection was explicitly requested to do so when created.
     *
     * <p>Implementations requiring more complex behavior should consider using
     * the {@link AbstractConnection} base class or implementing
     * {@link org.apache.guacamole.net.auth.Connection} directly.
     */
    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Make received tokens available within the legacy connect() strictly
        // in context of the current connect() call
        try {

            // Automatically filter configurations only if explicitly
            // configured to do so
            if (interpretTokens)
                currentTokens.set(tokens);

            return connect(info);

        }
        finally {
            currentTokens.remove();
        }
        
    }

    @Override
    public Date getLastActive() {
        return null;
    }
    
    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        return new SimpleActivityRecordSet<>();
    }

}
