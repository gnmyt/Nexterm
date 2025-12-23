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

package org.apache.guacamole.auth.json.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * All data associated with a particular user, as parsed from the JSON supplied
 * within the encrypted blob provided during authentication.
 */
public class UserData {

    /**
     * The username of the user associated with this data.
     */
    private String username;

    /**
     * The time after which this data is no longer valid and must not be used.
     * This is a UNIX-style epoch timestamp, stored as the number of
     * milliseconds since midnight of January 1, 1970 UTC.
     */
    private Long expires;

    /**
     * Whether this data can only be used once. If set to true, reuse of the
     * associated signed data will not be allowed. This is only valid if the
     * expiration timestamp has been set.
     */
    private boolean singleUse = false;

    /**
     * All connections accessible by this user. The key of each entry is both
     * the connection identifier and the connection name.
     */
    private ConcurrentMap<String, Connection> connections;

    /**
     * The data associated with a Guacamole connection stored within a UserData
     * object.
     */
    public static class Connection {

        /**
         * An arbitrary, opaque, unique ID for this connection. If specified
         * via the "join" (primaryConnection) property of another connection,
         * that connection may be used to join this connection.
         */
        private String id;

        /**
         * The protocol that this connection should use, such as "vnc" or "rdp".
         */
        private String protocol;

        /**
         * The opaque ID of the connection being joined (shared), as given with
         * the "id" property. If specified, the provided protocol is ignored.
         * This value is exposed via the "join" property within JSON.
         */
        private String primaryConnection;

        /**
         * Map of all connection parameter values, where each key is the parameter
         * name. Legal parameter names are dictated by the specified protocol and
         * are documented within the Guacamole manual:
         *
         * http://guac-dev.org/doc/gug/configuring-guacamole.html#connection-configuration
         */
        private Map<String, String> parameters;

        /**
         * Whether this connection can only be used once. If set to true, the
         * connection will be removed from the connections directory
         * immediately upon use.
         */
        private boolean singleUse = false;

        /**
         * Returns an arbitrary, opaque, unique ID for this connection. If
         * defined, this ID may be used via the "join" (primaryConnection)
         * property of another connection to join (share) this connection while
         * it is in progress.
         *
         * @return
         *    An arbitrary, opaque, unique ID for this connection.
         */
        public String getId() {
            return id;
        }

        /**
         * Sets an arbitrary, opaque ID which uniquely identifies this
         * connection. This ID may be used via the "join" (primaryConnection)
         * property of another connection to join (share) this connection while
         * it is in progress.
         *
         * @param id
         *    An arbitrary, opaque, unique ID for this connection.
         */
        public void setId(String id) {
            this.id = id;
        }

        /**
         * Returns the protocol that this connection should use, such as "vnc"
         * or "rdp".
         *
         * @return
         *     The name of the protocol to use, such as "vnc" or "rdp".
         */
        public String getProtocol() {
            return protocol;
        }

        /**
         * Sets the protocol that this connection should use, such as "vnc"
         * or "rdp".
         *
         * @param protocol
         *     The name of the protocol to use, such as "vnc" or "rdp".
         */
        public void setProtocol(String protocol) {
            this.protocol = protocol;
        }

        /**
         * Returns the opaque ID of the connection being joined (shared), if
         * any. If specified, any provided protocol is ignored. This value is
         * exposed via the "join" property within JSON.
         *
         * @return
         *     The opaque ID of the connection being joined (shared), if any.
         */
        @JsonProperty("join")
        public String getPrimaryConnection() {
            return primaryConnection;
        }

        /**
         * Sets the opaque ID of the connection being joined (shared). If
         * specified, any provided protocol is ignored. This is exposed via the
         * "join" property within JSON.
         *
         * @param primaryConnection
         *     The opaque ID of the connection being joined (shared).
         */
        @JsonProperty("join")
        public void setPrimaryConnection(String primaryConnection) {
            this.primaryConnection = primaryConnection;
        }

        /**
         * Returns a map of all parameter name/value pairs, where the key of
         * each entry in the map is the corresponding parameter name. Changes
         * to this map directly affect the parameters associated with this
         * connection.
         *
         * @return
         *     A map of all parameter name/value pairs associated with this
         *     connection.
         */
        public Map<String, String> getParameters() {
            return parameters;
        }

        /**
         * Replaces all parameters associated with this connection with the
         * name/value pairs in the provided map, where the key of each entry
         * in the map is the corresponding parameter name. Changes to this map
         * directly affect the parameters associated with this connection.
         *
         * @param parameters
         *     The map of all parameter name/value pairs to associate with this
         *     connection.
         */
        public void setParameters(Map<String, String> parameters) {
            this.parameters = parameters;
        }

        /**
         * Returns whether this connection is intended for single-use only. A
         * single-use connection cannot be used more than once.
         *
         * After a single-use connection is used, it should be automatically
         * and atomically removed from any underlying data (such as with
         * UserData.removeConnection()).
         *
         * @return
         *     true if this connection is intended for single-use only, false
         *     otherwise.
         */
        public boolean isSingleUse() {
            return singleUse;
        }

        /**
         * Sets whether this connection is intended for single-use only. A
         * single-use connection cannot be used more than once. By default,
         * connections are NOT single-use.
         *
         * After a single-use connection is used, it should be automatically
         * and atomically removed from any underlying data (such as with
         * UserData.removeConnection()).
         *
         * @param singleUse
         *     true if this connection is intended for single-use only, false
         *     otherwise.
         */
        public void setSingleUse(boolean singleUse) {
            this.singleUse = singleUse;
        }

    }

    /**
     * Returns the username of the user associated with the data stored in this
     * object.
     *
     * @return
     *     The username of the user associated with the data stored in this
     *     object.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the username of the user associated with the data stored in this
     * object.
     *
     * @param username
     *     The username of the user to associate with the data stored in this
     *     object.
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the time after which the data stored in this object is invalid
     * and must not be used. The time returned is a UNIX-style epoch timestamp
     * whose value is the number of milliseconds since midnight of January 1,
     * 1970 UTC. If this object does not expire, null is returned.
     *
     * @return
     *     The time after which the data stored in this object is invalid and
     *     must not be used, or null if this object does not expire.
     */
    public Long getExpires() {
        return expires;
    }

    /**
     * Sets the time after which the data stored in this object is invalid
     * and must not be used. The time provided MUST be a UNIX-style epoch
     * timestamp whose value is the number of milliseconds since midnight of
     * January 1, 1970 UTC. If this object should not expire, the value
     * provided should be null.
     *
     * @param expires
     *     The time after which the data stored in this object is invalid and
     *     must not be used, or null if this object does not expire.
     */
    public void setExpires(Long expires) {
        this.expires = expires;
    }

    /**
     * Returns whether this user data is intended for single-use only.
     * Single-use data cannot be used more than once. This flag only has
     * meaning if the data also has an expires timestamp.
     *
     * @return
     *     true if this data is intended for single-use only, false
     *     otherwise.
     */
    public boolean isSingleUse() {
        return singleUse;
    }

    /**
     * Sets whether this user data is intended for single-use only. Single-use
     * data cannot be used more than once. This flag only has meaning if the
     * data also has an expires timestamp. By default, user data is NOT
     * single-use.
     *
     * @param singleUse
     *     true if this data is intended for single-use only, false
     *     otherwise.
     */
    public void setSingleUse(boolean singleUse) {
        this.singleUse = singleUse;
    }

    /**
     * Returns all connections stored within this UserData object as an
     * unmodifiable map. Each of these connections is accessible by the user
     * specified by getUsername(). The key of each entry within the map is the
     * identifier and human-readable name of the corresponding connection.
     *
     * @return
     *     An unmodifiable map of all connections stored within this
     *     UserData object, where the key of each entry is the identifier of
     *     the corresponding connection.
     */
    public Map<String, Connection> getConnections() {
        return connections == null ? null : Collections.unmodifiableMap(connections);
    }

    /**
     * Replaces all connections stored within this UserData object with the
     * given connections. Each of these connections will be accessible by the
     * user specified by getUsername(). The key of each entry within the map is
     * the identifier and human-readable name of the corresponding connection.
     *
     * @param connections
     *     A map of all connections to be stored within this UserData object,
     *     where the key of each entry is the identifier of the corresponding
     *     connection.
     */
    public void setConnections(Map<String, Connection> connections) {
        this.connections = new ConcurrentHashMap<>(connections);
    }

    /**
     * Removes the connection having the given identifier from the overall map
     * of connections, such that it cannot be used further. This operation is
     * atomic.
     *
     * @param identifier
     *     The identifier of the connection to remove.
     *
     * @return
     *     The connection that was removed, or null if no such connection
     *     exists.
     */
    public Connection removeConnection(String identifier) {
        return connections.remove(identifier);
    }

    /**
     * Returns whether the data within this UserData object is expired, and
     * thus must not be used, according to the timestamp returned by
     * getExpires().
     *
     * @return
     *     true if the data within this UserData object is expired and must not
     *     be used, false otherwise.
     */
    @JsonIgnore
    public boolean isExpired() {

        // Do not bother comparing if this UserData object does not expire
        Long expirationTimestamp = getExpires();
        if (expirationTimestamp == null)
            return false;

        // Otherwise, compare expiration timestamp against system time
        return System.currentTimeMillis() > expirationTimestamp;

    }

}
