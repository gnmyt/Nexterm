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

package org.apache.guacamole.auth.jdbc.connectiongroup;

import com.google.inject.Inject;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.ModeledChildDirectoryObject;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.form.BooleanField;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.form.NumericField;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * An implementation of the ConnectionGroup object which is backed by a
 * database model.
 */
public class ModeledConnectionGroup extends ModeledChildDirectoryObject<ConnectionGroupModel>
    implements ConnectionGroup {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ModeledConnectionGroup.class);

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
     * The name of the attribute which controls whether individual users will be
     * consistently assigned the same connection within a balancing group until
     * they log out.
     */
    public static final String ENABLE_SESSION_AFFINITY = "enable-session-affinity";

    /**
     * All attributes related to restricting user accounts, within a logical
     * form.
     */
    public static final Form CONCURRENCY_LIMITS = new Form("concurrency", Arrays.<Field>asList(
        new NumericField(MAX_CONNECTIONS_NAME),
        new NumericField(MAX_CONNECTIONS_PER_USER_NAME),
        new BooleanField(ENABLE_SESSION_AFFINITY, "true")
    ));

    /**
     * All possible attributes of connection group objects organized as
     * individual, logical forms.
     */
    public static final Collection<Form> ATTRIBUTES = Collections.unmodifiableCollection(Arrays.asList(
        CONCURRENCY_LIMITS
    ));

    /**
     * The names of all attributes which are explicitly supported by this
     * extension's ConnectionGroup objects.
     */
    public static final Set<String> ATTRIBUTE_NAMES =
            Collections.unmodifiableSet(new HashSet<String>(Arrays.asList(
                MAX_CONNECTIONS_NAME,
                MAX_CONNECTIONS_PER_USER_NAME,
                ENABLE_SESSION_AFFINITY
            )));

    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Service for managing connection groups.
     */
    @Inject
    private ConnectionGroupService connectionGroupService;

    /**
     * Service for creating and tracking tunnels.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * Creates a new, empty ModeledConnectionGroup.
     */
    public ModeledConnectionGroup() {
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
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        return connectionGroupService.connect(getCurrentUser(), this, info, tokens);
    }

    @Override
    public int getActiveConnections() {
        return tunnelService.getActiveConnections(this).size();
    }

    @Override
    public void setType(Type type) {
        getModel().setType(type);
    }

    @Override
    public Type getType() {
        return getModel().getType();
    }

    @Override
    public Set<String> getConnectionIdentifiers()
            throws GuacamoleException {
        return getModel().getConnectionIdentifiers();
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers()
            throws GuacamoleException {
        return getModel().getConnectionGroupIdentifiers();
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

        // Set session affinity attribute
        attributes.put(ENABLE_SESSION_AFFINITY,
                getModel().isSessionAffinityEnabled() ? "true" : "");

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

        // Translate session affinity attribute
        getModel().setSessionAffinityEnabled(
                "true".equals(attributes.get(ENABLE_SESSION_AFFINITY)));

    }

    /**
     * Returns the maximum number of connections that should be allowed to this
     * connection group overall. If no limit applies, zero is returned.
     *
     * @return
     *     The maximum number of connections that should be allowed to this
     *     connection group overall, or zero if no limit applies.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing the concurrency limit properties
     *     specified within guacamole.properties.
     */
    public int getMaxConnections() throws GuacamoleException {

        // Pull default from environment if connection limit is unset
        Integer value = getModel().getMaxConnections();
        if (value == null)
            return environment.getDefaultMaxGroupConnections();

        // Otherwise use defined value
        return value;

    }

    /**
     * Returns the maximum number of connections that should be allowed to this
     * connection group for any individual user. If no limit applies, zero is
     * returned.
     *
     * @return
     *     The maximum number of connections that should be allowed to this
     *     connection group for any individual user, or zero if no limit
     *     applies.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing the concurrency limit properties
     *     specified within guacamole.properties.
     */
    public int getMaxConnectionsPerUser() throws GuacamoleException {

        // Pull default from environment if per-user connection limit is unset
        Integer value = getModel().getMaxConnectionsPerUser();
        if (value == null)
            return environment.getDefaultMaxGroupConnectionsPerUser();

        // Otherwise use defined value
        return value;

    }

    /**
     * Returns whether individual users should be consistently assigned the same
     * connection within a balancing group until they log out.
     *
     * @return
     *     Whether individual users should be consistently assigned the same
     *     connection within a balancing group until they log out.
     */
    public boolean isSessionAffinityEnabled() {
        return getModel().isSessionAffinityEnabled();
    }

}
