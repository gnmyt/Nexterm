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

package org.apache.guacamole.auth.jdbc.activeconnection;

import com.google.inject.Inject;
import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.base.RestrictedObject;
import org.apache.guacamole.auth.jdbc.connection.ModeledConnection;
import org.apache.guacamole.auth.jdbc.sharing.ConnectionSharingService;
import org.apache.guacamole.auth.jdbc.sharing.connection.SharedConnectionDefinition;
import org.apache.guacamole.auth.jdbc.tunnel.ActiveConnectionRecord;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.credentials.UserCredentials;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * An implementation of the ActiveConnection object which has an associated
 * ActiveConnectionRecord.
 */
public class TrackedActiveConnection extends RestrictedObject implements ActiveConnection {

    /**
     * Service for managing shared connections.
     */
    @Inject
    private ConnectionSharingService sharingService;

    /**
     * Service for creating and tracking tunnels.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * The identifier of this active connection.
     */
    private String identifier;

    /**
     * The actual connection record from which this ActiveConnection derives its
     * data.
     */
    private ActiveConnectionRecord connectionRecord;

    /**
     * The connection being actively used or shared.
     */
    private ModeledConnection connection;

    /**
     * The identifier of the associated sharing profile.
     */
    private String sharingProfileIdentifier;

    /**
     * The date and time this active connection began.
     */
    private Date startDate;

    /**
     * The remote host that initiated this connection.
     */
    private String remoteHost;

    /**
     * The username of the user that initiated this connection.
     */
    private String username;

    /**
     * The underlying GuacamoleTunnel.
     */
    private GuacamoleTunnel tunnel;

    /**
     * Whether connections to this TrackedActiveConnection are allowed.
     */
    private boolean connectable;

    /**
     * Initializes this TrackedActiveConnection, copying the data associated
     * with the given active connection record. At a minimum, the identifier
     * of this active connection will be set, the start date, and the
     * identifier of the associated connection will be copied. If requested,
     * sensitive information like the associated username will be copied, as
     * well.
     *
     * @param currentUser
     *     The user that created or retrieved this object.
     *
     * @param activeConnectionRecord
     *     The active connection record to copy.
     *
     * @param includeSensitiveInformation
     *     Whether sensitive data should be copied from the connection record
     *     as well. This includes the remote host, associated tunnel, and
     *     username.
     *
     * @param connectable
     *     Whether the user that retrieved this object should be allowed to
     *     join the active connection.
     */
    public void init(ModeledAuthenticatedUser currentUser,
            ActiveConnectionRecord activeConnectionRecord,
            boolean includeSensitiveInformation,
            boolean connectable) {

        super.init(currentUser);
        this.connectionRecord = activeConnectionRecord;
        this.connectable      = connectable;
        
        // Copy all non-sensitive data from given record
        this.connection               = activeConnectionRecord.getConnection();
        this.sharingProfileIdentifier = activeConnectionRecord.getSharingProfileIdentifier();
        this.identifier               = activeConnectionRecord.getUUID().toString();
        this.startDate                = activeConnectionRecord.getStartDate();

        // Include sensitive data, too, if requested
        if (includeSensitiveInformation) {
            this.remoteHost = activeConnectionRecord.getRemoteHost();
            this.tunnel     = activeConnectionRecord.getTunnel();
            this.username   = activeConnectionRecord.getUsername();
        }

    }

    @Override
    public String getIdentifier() {
        return identifier;
    }

    @Override
    public void setIdentifier(String identifier) {
        this.identifier = identifier;
    }

    /**
     * Returns the connection being actively used. If this active connection is
     * not the primary connection, this will be the connection being actively
     * shared.
     *
     * @return
     *     The connection being actively used.
     */
    public ModeledConnection getConnection() {
        return connection;
    }

    @Override
    public String getConnectionIdentifier() {
        return connection.getIdentifier();
    }

    @Override
    public void setConnectionIdentifier(String connnectionIdentifier) {
        throw new UnsupportedOperationException("The connection identifier of "
                + "TrackedActiveConnection is inherited from the underlying "
                + "connection.");
    }

    @Override
    public String getSharingProfileIdentifier() {
        return sharingProfileIdentifier;
    }

    @Override
    public void setSharingProfileIdentifier(String sharingProfileIdentifier) {
        this.sharingProfileIdentifier = sharingProfileIdentifier;
    }

    /**
     * Shares this active connection with the user that retrieved it, returning
     * a SharedConnectionDefinition that can be used to establish a tunnel to
     * the shared connection. If provided, access within the shared connection
     * will be restricted by the sharing profile with the given identifier.
     *
     * @param identifier
     *     The identifier of the sharing profile that defines the restrictions
     *     applying to the shared connection, or null if no such restrictions
     *     apply.
     *
     * @return
     *     A new SharedConnectionDefinition which can be used to establish a
     *     tunnel to the shared connection.
     *
     * @throws GuacamoleException
     *     If permission to share this active connection is denied.
     */
    private SharedConnectionDefinition share(String identifier) throws GuacamoleException {
        return sharingService.shareConnection(getCurrentUser(), connectionRecord, identifier);
    }

    @Override
    public UserCredentials getSharingCredentials(String identifier)
            throws GuacamoleException {
        return sharingService.getSharingCredentials(share(identifier));
    }

    @Override
    public Date getStartDate() {
        return startDate;
    }

    @Override
    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    @Override
    public String getRemoteHost() {
        return remoteHost;
    }

    @Override
    public void setRemoteHost(String remoteHost) {
        this.remoteHost = remoteHost;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public void setUsername(String username) {
        this.username = username;
    }

    @Override
    public GuacamoleTunnel getTunnel() {
        return tunnel;
    }

    @Override
    public void setTunnel(GuacamoleTunnel tunnel) {
        this.tunnel = tunnel;
    }

    @Override
    public boolean isConnectable() {
        return connectable;
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Establish connection only if connecting is allowed
        if (isConnectable())
            return tunnelService.getGuacamoleTunnel(getCurrentUser(), share(null), info, tokens);

        throw new GuacamoleSecurityException("Permission denied.");

    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

}
