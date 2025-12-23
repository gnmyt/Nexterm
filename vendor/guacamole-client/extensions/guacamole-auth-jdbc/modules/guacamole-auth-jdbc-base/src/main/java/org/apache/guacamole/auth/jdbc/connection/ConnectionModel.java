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

import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.base.ChildObjectModel;
import org.apache.guacamole.net.auth.GuacamoleProxyConfiguration.EncryptionMethod;

/**
 * Object representation of a Guacamole connection, as represented in the
 * database.
 */
public class ConnectionModel extends ChildObjectModel {

    /**
     * The human-readable name associated with this connection.
     */
    private String name;

    /**
     * The name of the protocol to use when connecting to this connection.
     */
    private String protocol;

    /**
     * The maximum number of connections that can be established to this
     * connection concurrently, zero if no restriction applies, or null if the
     * default restrictions should be applied.
     */
    private Integer maxConnections;

    /**
     * The maximum number of connections that can be established to this
     * connection concurrently by any one user, zero if no restriction applies,
     * or null if the default restrictions should be applied.
     */
    private Integer maxConnectionsPerUser;

    /**
     * The weight of the connection for the purposes of calculating
     * WLC algorithm.  null indicates nothing has been set, and anything less
     * than 1 eliminates the system from being used for connections.
     */
    private Integer connectionWeight;

    /**
     * Whether this connection should be reserved for failover. Failover-only
     * connections within a balancing group are only used when all non-failover
     * connections are unavailable.
     */
    private boolean failoverOnly;

    /**
     * The identifiers of all readable sharing profiles associated with this
     * connection.
     */
    private Set<String> sharingProfileIdentifiers = new HashSet<String>();

    /**
     * The hostname of the guacd instance to use, or null if the hostname of the
     * default guacd instance should be used.
     */
    private String proxyHostname;

    /**
     * The port of the guacd instance to use, or null if the port of the default
     * guacd instance should be used.
     */
    private Integer proxyPort;

    /**
     * The encryption method required by the desired guacd instance, or null if
     * the encryption method of the default guacd instance should be used.
     */
    private EncryptionMethod proxyEncryptionMethod;

    /**
     * The date and time that this connection was last used, or null if this
     * connection has never been used.
     */
    private Date lastActive;

    /**
     * Creates a new, empty connection.
     */
    public ConnectionModel() {
    }

    /**
     * Returns the name associated with this connection.
     *
     * @return
     *     The name associated with this connection.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name associated with this connection.
     *
     * @param name
     *     The name to associate with this connection.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the name of the protocol to use when connecting to this
     * connection.
     *
     * @return
     *     The name of the protocol to use when connecting to this connection.
     */
    public String getProtocol() {
        return protocol;
    }

    /**
     * Sets the name of the protocol to use when connecting to this connection.
     *
     * @param protocol
     *     The name of the protocol to use when connecting to this connection.
     */
    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    /**
     * Returns the maximum number of connections that can be established to
     * this connection concurrently.
     *
     * @return
     *     The maximum number of connections that can be established to this
     *     connection concurrently, zero if no restriction applies, or null if
     *     the default restrictions should be applied.
     */
    public Integer getMaxConnections() {
        return maxConnections;
    }

    /**
     * Sets the maximum number of connections that can be established to this
     * connection concurrently.
     *
     * @param maxConnections
     *     The maximum number of connections that can be established to this
     *     connection concurrently, zero if no restriction applies, or null if
     *     the default restrictions should be applied.
     */
    public void setMaxConnections(Integer maxConnections) {
        this.maxConnections = maxConnections;
    }

    /**
     * Returns the maximum number of connections that can be established to
     * this connection concurrently by any one user.
     *
     * @return
     *     The maximum number of connections that can be established to this
     *     connection concurrently by any one user, zero if no restriction
     *     applies, or null if the default restrictions should be applied.
     */
    public Integer getMaxConnectionsPerUser() {
        return maxConnectionsPerUser;
    }

    /**
     * Sets the connection weight for load balancing.
     *
     * @param connectionWeight
     *     The weight of the connection used in load balancing. 
     *     The value is not required for the connection (null), and
     *     values less than 1 will prevent the connection from being
     *     used.
     */
    public void setConnectionWeight(Integer connectionWeight) {
        this.connectionWeight = connectionWeight;
    }

    /**
     * Returns the connection weight used in applying weighted
     * load balancing algorithms.
     *
     * @return
     *     The connection weight used in applying weighted
     *     load balancing aglorithms.
     */
    public Integer getConnectionWeight() {
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
        return failoverOnly;
    }

    /**
     * Sets whether this connection should be reserved for failover.
     * Failover-only connections within a balancing group are only used when
     * all non-failover connections are unavailable.
     *
     * @param failoverOnly
     *     true if this connection should be reserved for failover, false
     *     otherwise.
     */
    public void setFailoverOnly(boolean failoverOnly) {
        this.failoverOnly = failoverOnly;
    }

    /**
     * Sets the maximum number of connections that can be established to this
     * connection concurrently by any one user.
     *
     * @param maxConnectionsPerUser
     *     The maximum number of connections that can be established to this
     *     connection concurrently by any one user, zero if no restriction
     *     applies, or null if the default restrictions should be applied.
     */
    public void setMaxConnectionsPerUser(Integer maxConnectionsPerUser) {
        this.maxConnectionsPerUser = maxConnectionsPerUser;
    }

    /**
     * Returns the hostname of the guacd instance to use. If the hostname of the
     * default guacd instance should be used instead, null is returned.
     *
     * @return
     *     The hostname of the guacd instance to use, or null if the hostname
     *     of the default guacd instance should be used.
     */
    public String getProxyHostname() {
        return proxyHostname;
    }

    /**
     * Sets the hostname of the guacd instance to use.
     *
     * @param proxyHostname
     *     The hostname of the guacd instance to use, or null if the hostname
     *     of the default guacd instance should be used.
     */
    public void setProxyHostname(String proxyHostname) {
        this.proxyHostname = proxyHostname;
    }

    /**
     * Returns the port of the guacd instance to use. If the port of the default
     * guacd instance should be used instead, null is returned.
     *
     * @return
     *     The port of the guacd instance to use, or null if the port of the
     *     default guacd instance should be used.
     */
    public Integer getProxyPort() {
        return proxyPort;
    }

    /**
     * Sets the port of the guacd instance to use.
     *
     * @param proxyPort
     *     The port of the guacd instance to use, or null if the port of the
     *     default guacd instance should be used.
     */
    public void setProxyPort(Integer proxyPort) {
        this.proxyPort = proxyPort;
    }

    /**
     * Returns the type of encryption required by the desired guacd instance.
     * If the encryption method of the default guacd instance should be used
     * instead, null is returned.
     *
     * @return
     *     The type of encryption required by the desired guacd instance, or
     *     null if the encryption method of the default guacd instance should
     *     be used.
     */
    public EncryptionMethod getProxyEncryptionMethod() {
        return proxyEncryptionMethod;
    }

    /**
     * Sets the type of encryption which should be used when connecting to
     * guacd, if any.
     *
     * @param proxyEncryptionMethod
     *     The type of encryption required by the desired guacd instance, or
     *     null if the encryption method of the default guacd instance should
     *     be used.
     */
    public void setProxyEncryptionMethod(EncryptionMethod proxyEncryptionMethod) {
        this.proxyEncryptionMethod = proxyEncryptionMethod;
    }

    /**
     * Returns the identifiers of all readable sharing profiles associated with
     * this connection. This is set only when the connection is queried, and has
     * no effect when a connection is inserted, updated, or deleted.
     *
     * @return
     *     The identifiers of all readable sharing profiles associated with
     *     this connection.
     */
    public Set<String> getSharingProfileIdentifiers() {
        return sharingProfileIdentifiers;
    }

    /**
     * Sets the identifiers of all readable sharing profiles associated with
     * this connection. This should be set only when the connection is queried,
     * as it has no effect when a connection is inserted, updated, or deleted.
     *
     * @param sharingProfileIdentifiers
     *     The identifiers of all readable sharing profiles associated with
     *     this connection.
     */
    public void setSharingProfileIdentifiers(Set<String> sharingProfileIdentifiers) {
        this.sharingProfileIdentifiers = sharingProfileIdentifiers;
    }

    /**
     * Returns the date and time that this connection was last used, or null if
     * this connection has never been used.
     *
     * @return
     *     The date and time that this connection was last used, or null if this
     *     connection has never been used.
     */
    public Date getLastActive() {
        return lastActive;
    }

    /**
     * Sets the date and time that this connection was last used. This value is
     * expected to be set automatically via queries, derived from connection
     * history records. It does NOT correspond to an actual column, and values
     * set manually through invoking this function will not persist.
     *
     * @param lastActive
     *     The date and time that this connection was last used, or null if this
     *     connection has never been used.
     */
    public void setLastActive(Date lastActive) {
        this.lastActive = lastActive;
    }

    @Override
    public String getIdentifier() {

        // If no associated ID, then no associated identifier
        Integer id = getObjectID();
        if (id == null)
            return null;

        // Otherwise, the identifier is the ID as a string
        return id.toString();

    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Connection identifiers are derived from IDs. They cannot be set.");
    }

}
