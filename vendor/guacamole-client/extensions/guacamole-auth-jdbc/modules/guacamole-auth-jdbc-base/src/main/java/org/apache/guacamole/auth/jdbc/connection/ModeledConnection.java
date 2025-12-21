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

package org.apache.guacamole.auth.jdbc.connection;

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.ModeledChildDirectoryObject;
import org.apache.guacamole.form.BooleanField;
import org.apache.guacamole.form.EnumField;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.form.NumericField;
import org.apache.guacamole.form.TextField;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.GuacamoleProxyConfiguration;
import org.apache.guacamole.net.auth.GuacamoleProxyConfiguration.EncryptionMethod;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * An implementation of the Connection object which is backed by a database
 * model.
 */
public class ModeledConnection extends ModeledChildDirectoryObject<ConnectionModel>
    implements Connection {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ModeledConnection.class);

    /**
     * The name of the attribute which overrides the hostname used to connect
     * to guacd for this connection.
     */
    public static final String GUACD_HOSTNAME_NAME = "guacd-hostname";

    /**
     * The name of the attribute which overrides the port used to connect to
     * guacd for this connection.
     */
    public static final String GUACD_PORT_NAME = "guacd-port";

    /**
     * The name of the attribute which overrides the encryption method used to
     * connect to guacd for this connection.
     */
    public static final String GUACD_ENCRYPTION_NAME = "guacd-encryption";

    /**
     * The value specified for the "guacd-encryption" attribute if encryption
     * should not be used to connect to guacd.
     */
    public static final String GUACD_ENCRYPTION_VALUE_NONE = "none";

    /**
     * The value specified for the "guacd-encryption" attribute if SSL/TLS
     * encryption should be used to connect to guacd.
     */
    public static final String GUACD_ENCRYPTION_VALUE_SSL = "ssl";

    /**
     * All attributes which describe the configuration of the guacd instance
     * which will be used to connect to the remote desktop described by this
     * connection.
     */
    public static final Form GUACD_PARAMETERS = new Form("guacd", Arrays.<Field>asList(
        new TextField(GUACD_HOSTNAME_NAME),
        new NumericField(GUACD_PORT_NAME),
        new EnumField(GUACD_ENCRYPTION_NAME, Arrays.asList(
            "",
            GUACD_ENCRYPTION_VALUE_NONE,
            GUACD_ENCRYPTION_VALUE_SSL
        ))
    ));

    /**
     * The name of the attribute which controls the maximum number of
     * concurrent connections.
     */
    public static final String MAX_CONNECTIONS_NAME = "max-connections";

    /**
     * The name of the attribute which controls the maximum number of
     * concurrent connections per user.
     */
    public static final String MAX_CONNECTIONS_PER_USER_NAME = "max-connections-per-user";

    /**
     * The connection weight attribute used for weighted load balancing algorithms.
     */
    public static final String CONNECTION_WEIGHT = "weight";

    /**
     * The name of the attribute which controls whether the connection should
     * be used as a spare only (all other non-spare connections within the same
     * balancing group should be preferred).
     */
    public static final String FAILOVER_ONLY_NAME = "failover-only";

    /**
     * All attributes related to restricting user accounts, within a logical
     * form.
     */
    public static final Form CONCURRENCY_LIMITS = new Form("concurrency", Arrays.<Field>asList(
        new NumericField(MAX_CONNECTIONS_NAME),
        new NumericField(MAX_CONNECTIONS_PER_USER_NAME)
    ));

    /**
     * All attributes related to load balancing in a logical form.
     */
    public static final Form LOAD_BALANCING = new Form("load-balancing", Arrays.<Field>asList(
        new NumericField(CONNECTION_WEIGHT),
        new BooleanField(FAILOVER_ONLY_NAME, "true")
    ));

    /**
     * All possible attributes of connection objects organized as individual,
     * logical forms.
     */
    public static final Collection<Form> ATTRIBUTES = Collections.unmodifiableCollection(Arrays.asList(
        CONCURRENCY_LIMITS,
        LOAD_BALANCING,
        GUACD_PARAMETERS
    ));

    /**
     * The names of all attributes which are explicitly supported by this
     * extension's Connection objects.
     */
    public static final Set<String> ATTRIBUTE_NAMES =
            Collections.unmodifiableSet(new HashSet<String>(Arrays.asList(
                GUACD_HOSTNAME_NAME,
                GUACD_PORT_NAME,
                GUACD_ENCRYPTION_NAME,
                MAX_CONNECTIONS_NAME,
                MAX_CONNECTIONS_PER_USER_NAME,
                CONNECTION_WEIGHT,
                FAILOVER_ONLY_NAME
            )));

    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Service for managing connections.
     */
    @Inject
    private ConnectionService connectionService;

    /**
     * Service for creating and tracking tunnels.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * Provider for lazy-loaded, permission-controlled configurations.
     */
    @Inject
    private Provider<ModeledGuacamoleConfiguration> configProvider;
    
    /**
     * Provider for creating connection record sets.
     */
    @Inject
    private Provider<ConnectionRecordSet> connectionRecordSetProvider;
    
    /**
     * The manually-set GuacamoleConfiguration, if any.
     */
    private GuacamoleConfiguration config = null;

    /**
     * Creates a new, empty ModeledConnection.
     */
    public ModeledConnection() {
    }

    @Override
    public String getName() {
        return getModel().getName();
    }

    @Override
    public void setName(String name) {
        getModel().setName(name);
    }

    @Override
    public GuacamoleConfiguration getConfiguration() {

        // If configuration has been manually set, return that
        if (config != null)
            return config;

        // Otherwise, return permission-controlled configuration
        ModeledGuacamoleConfiguration restrictedConfig = configProvider.get();
        restrictedConfig.init(getCurrentUser(), getModel());
        return restrictedConfig;

    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {

        // Store manually-set configuration internally
        this.config = config;

        // Update model
        getModel().setProtocol(config.getProtocol());
        
    }

    @Override
    public Set<String> getSharingProfileIdentifiers()
            throws GuacamoleException {
        return getModel().getSharingProfileIdentifiers();
    }

    @Override
    public Date getLastActive() {
        return getModel().getLastActive();
    }
    
    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        ConnectionRecordSet connectionRecordSet = connectionRecordSetProvider.get();
        connectionRecordSet.init(getCurrentUser(), this.getIdentifier());
        return connectionRecordSet;
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        return connectionService.connect(getCurrentUser(), this, info, tokens);
    }

    @Override
    public int getActiveConnections() {
        return tunnelService.getActiveConnections(this).size();
    }

    @Override
    public Set<String> getSupportedAttributeNames() {
        return ATTRIBUTE_NAMES;
    }

    @Override
    public Map<String, String> getAttributes() {

        // Include any defined arbitrary attributes
        Map<String, String> attributes = super.getAttributes();

        // Set connection limit attribute
        attributes.put(MAX_CONNECTIONS_NAME, NumericField.format(getModel().getMaxConnections()));

        // Set per-user connection limit attribute
        attributes.put(MAX_CONNECTIONS_PER_USER_NAME, NumericField.format(getModel().getMaxConnectionsPerUser()));

        // Set guacd (proxy) hostname and port
        attributes.put(GUACD_HOSTNAME_NAME, getModel().getProxyHostname());
        attributes.put(GUACD_PORT_NAME, NumericField.format(getModel().getProxyPort()));

        // Set guacd (proxy) encryption method
        EncryptionMethod encryptionMethod = getModel().getProxyEncryptionMethod();
        if (encryptionMethod == null)
            attributes.put(GUACD_ENCRYPTION_NAME, null);

        else {
            switch (encryptionMethod) {

                // Unencrypted
                case NONE:
                    attributes.put(GUACD_ENCRYPTION_NAME, GUACD_ENCRYPTION_VALUE_NONE);
                    break;

                // SSL / TLS encryption
                case SSL:
                    attributes.put(GUACD_ENCRYPTION_NAME, GUACD_ENCRYPTION_VALUE_SSL);
                    break;

                // Unimplemented / unspecified
                default:
                    attributes.put(GUACD_ENCRYPTION_NAME, null);

            }
        }

        // Set connection weight
        attributes.put(CONNECTION_WEIGHT, NumericField.format(getModel().getConnectionWeight()));

        // Set whether connection is failover-only
        attributes.put(FAILOVER_ONLY_NAME, getModel().isFailoverOnly() ? "true" : null);

        return attributes;
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {

        // Set arbitrary attributes
        super.setAttributes(attributes);

        // Translate connection limit attribute
        try { getModel().setMaxConnections(NumericField.parse(attributes.get(MAX_CONNECTIONS_NAME))); }
        catch (NumberFormatException e) {
            logger.warn("Not setting maximum connections: {}", e.getMessage());
            logger.debug("Unable to parse numeric attribute.", e);
        }

        // Translate per-user connection limit attribute
        try { getModel().setMaxConnectionsPerUser(NumericField.parse(attributes.get(MAX_CONNECTIONS_PER_USER_NAME))); }
        catch (NumberFormatException e) {
            logger.warn("Not setting maximum connections per user: {}", e.getMessage());
            logger.debug("Unable to parse numeric attribute.", e);
        }

        // Translate guacd hostname
        getModel().setProxyHostname(TextField.parse(attributes.get(GUACD_HOSTNAME_NAME)));

        // Translate guacd port
        try { getModel().setProxyPort(NumericField.parse(attributes.get(GUACD_PORT_NAME))); }
        catch (NumberFormatException e) {
            logger.warn("Not setting guacd port: {}", e.getMessage());
            logger.debug("Unable to parse numeric attribute.", e);
        }

        // Translate guacd encryption method
        String encryptionMethod = attributes.get(GUACD_ENCRYPTION_NAME);

        // Unencrypted
        if (GUACD_ENCRYPTION_VALUE_NONE.equals(encryptionMethod))
            getModel().setProxyEncryptionMethod(EncryptionMethod.NONE);

        // SSL / TLS
        else if (GUACD_ENCRYPTION_VALUE_SSL.equals(encryptionMethod))
            getModel().setProxyEncryptionMethod(EncryptionMethod.SSL);

        // Unimplemented / unspecified
        else
            getModel().setProxyEncryptionMethod(null);

        // Translate connection weight attribute
        try { getModel().setConnectionWeight(NumericField.parse(attributes.get(CONNECTION_WEIGHT))); }
        catch (NumberFormatException e) {
            logger.warn("Not setting the connection weight: {}", e.getMessage());
            logger.debug("Unable to parse numeric attribute.", e);
        }

        // Translate failover-only attribute
        getModel().setFailoverOnly("true".equals(attributes.get(FAILOVER_ONLY_NAME)));

    }

    /**
     * Returns the maximum number of connections that should be allowed to this
     * connection overall. If no limit applies, zero is returned.
     *
     * @return
     *     The maximum number of connections that should be allowed to this
     *     connection overall, or zero if no limit applies.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing the concurrency limit properties
     *     specified within guacamole.properties.
     */
    public int getMaxConnections() throws GuacamoleException {

        // Pull default from environment if connection limit is unset
        Integer value = getModel().getMaxConnections();
        if (value == null)
            return environment.getDefaultMaxConnections();

        // Otherwise use defined value
        return value;

    }

    /**
     * Returns the maximum number of connections that should be allowed to this
     * connection for any individual user. If no limit applies, zero is
     * returned.
     *
     * @return
     *     The maximum number of connections that should be allowed to this
     *     connection for any individual user, or zero if no limit applies.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing the concurrency limit properties
     *     specified within guacamole.properties.
     */
    public int getMaxConnectionsPerUser() throws GuacamoleException {

        // Pull default from environment if per-user connection limit is unset
        Integer value = getModel().getMaxConnectionsPerUser();
        if (value == null)
            return environment.getDefaultMaxConnectionsPerUser();

        // Otherwise use defined value
        return value;

    }

    /**
     * Returns the connection information which should be used to connect to
     * guacd when establishing a connection to the remote desktop described by
     * this connection. If no such information is defined for this specific
     * remote desktop connection, the default guacd connection information will
     * be used instead, as defined by JDBCEnvironment.
     *
     * @return
     *     The connection information which should be used to connect to guacd
     *     when establishing a connection to the remote desktop described by
     *     this connection.
     *
     * @throws GuacamoleException
     *     If the connection information for guacd cannot be parsed.
     */
    public GuacamoleProxyConfiguration getGuacamoleProxyConfiguration()
            throws GuacamoleException {

        // Retrieve default proxy configuration from environment
        GuacamoleProxyConfiguration defaultConfig = environment.getDefaultGuacamoleProxyConfiguration();

        // Retrieve proxy configuration overrides from model
        String hostname = getModel().getProxyHostname();
        Integer port = getModel().getProxyPort();
        EncryptionMethod encryptionMethod = getModel().getProxyEncryptionMethod();

        // Produce new proxy configuration from model, using defaults where unspecified
        return new GuacamoleProxyConfiguration(
            hostname         != null ? hostname         : defaultConfig.getHostname(),
            port             != null ? port             : defaultConfig.getPort(),
            encryptionMethod != null ? encryptionMethod : defaultConfig.getEncryptionMethod()
        );
    }

    /** 
     * Returns the weight of the connection used in applying weighted
     * load balancing algorithms, or a default of 1 if the 
     * attribute is undefined.
     *  
     * @return
     *     The weight of the connection used in applying weighted
     *     load balancing algorithms.
     */
    public int getConnectionWeight() {

        Integer connectionWeight = getModel().getConnectionWeight();
        if (connectionWeight == null)
            return 1;
        return connectionWeight;

    }

    /**
     * Returns whether this connection should be reserved for failover.
     * Failover-only connections within a balancing group are only used when
     * all non-failover connections are unavailable.
     *
     * @return
     *     true if this connection should be reserved for failover, false
     *     otherwise.
     */
    public boolean isFailoverOnly() {
        return getModel().isFailoverOnly();
    }

}
