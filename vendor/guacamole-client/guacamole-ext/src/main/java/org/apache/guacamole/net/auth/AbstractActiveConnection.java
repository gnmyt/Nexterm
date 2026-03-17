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
import org.apache.guacamole.net.GuacamoleTunnel;

/**
 * Base implementation of an ActiveConnection, providing storage and simply
 * getters/setters for its main properties.
 */
public abstract class AbstractActiveConnection extends AbstractIdentifiable
        implements ActiveConnection {

    /**
     * The identifier of the associated connection.
     */
    private String connectionIdentifier;

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

    @Override
    public String getConnectionIdentifier() {
        return connectionIdentifier;
    }

    @Override
    public void setConnectionIdentifier(String connnectionIdentifier) {
        this.connectionIdentifier = connnectionIdentifier;
    }

    @Override
    public String getSharingProfileIdentifier() {
        return sharingProfileIdentifier;
    }

    @Override
    public void setSharingProfileIdentifier(String sharingProfileIdentifier) {
        this.sharingProfileIdentifier = sharingProfileIdentifier;
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

}
