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

package org.apache.guacamole.net.auth;

import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * A pairing of username and GuacamoleTunnel representing an active usage of a
 * particular connection.
 */
public interface ActiveConnection extends Identifiable, Connectable,
        Shareable<SharingProfile> {

    /**
     * Returns the identifier of the connection being actively used. Unlike the
     * other information stored in this object, the connection identifier must
     * be present and MAY NOT be null.
     *
     * @return
     *     The identifier of the connection being actively used.
     */
    String getConnectionIdentifier();

    /**
     * Sets the identifier of the connection being actively used.
     *
     * @param connnectionIdentifier
     *     The identifier of the connection being actively used.
     */
    void setConnectionIdentifier(String connnectionIdentifier);

    /**
     * Returns the identifier of the sharing profile being actively used. If
     * the connection is being accessed directly, this will be null.
     *
     * @return
     *     The identifier of the sharing profile being actively used.
     */
    String getSharingProfileIdentifier();

    /**
     * Sets the identifier of the sharing profile being actively used.
     *
     * @param sharingProfileIdentifier
     *     The identifier of the sharing profile being actively used.
     */
    void setSharingProfileIdentifier(String sharingProfileIdentifier);

    /**
     * Returns the date and time the connection began.
     *
     * @return
     *     The date and time the connection began, or null if this
     *     information is not available.
     */
    Date getStartDate();

    /**
     * Sets the date and time the connection began.
     *
     * @param startDate 
     *     The date and time the connection began, or null if this
     *     information is not available.
     */
    void setStartDate(Date startDate);

    /**
     * Returns the hostname or IP address of the remote host that initiated the
     * connection, if known. If the hostname or IP address is not known, null
     * is returned.
     *
     * @return
     *     The hostname or IP address of the remote host, or null if this
     *     information is not available.
     */
    String getRemoteHost();

    /**
     * Sets the hostname or IP address of the remote host that initiated the
     * connection.
     * 
     * @param remoteHost 
     *     The hostname or IP address of the remote host, or null if this
     *     information is not available.
     */
    void setRemoteHost(String remoteHost);

    /**
     * Returns the name of the user who is using this connection.
     *
     * @return
     *     The name of the user who is using this connection, or null if this
     *     information is not available.
     */
    String getUsername();

    /**
     * Sets the name of the user who is using this connection.
     *
     * @param username 
     *     The name of the user who is using this connection, or null if this
     *     information is not available.
     */
    void setUsername(String username);

    /**
     * Returns the connected GuacamoleTunnel being used. This may be null if
     * access to the underlying tunnel is denied.
     *
     * @return
     *     The connected GuacamoleTunnel, or null if permission is denied.
     */
    GuacamoleTunnel getTunnel();

    /**
     * Sets the connected GuacamoleTunnel being used.
     *
     * @param tunnel
     *     The connected GuacamoleTunnel, or null if permission is denied.
     */
    void setTunnel(GuacamoleTunnel tunnel);

    /**
     * Returns whether this ActiveConnection may be joined through a call to
     * {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation, java.util.Map)}
     * by the user that retrieved this ActiveConnection.
     *
     * @return
     *     true if the user that retrieved this ActiveConnection may join the
     *     ActiveConnection through a call to
     *     {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation, java.util.Map)},
     *     false otherwise.
     */
    default boolean isConnectable() {
        return false;
    }

    @Override
    default GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    default int getActiveConnections() {
        return 0;
    }
    
}
