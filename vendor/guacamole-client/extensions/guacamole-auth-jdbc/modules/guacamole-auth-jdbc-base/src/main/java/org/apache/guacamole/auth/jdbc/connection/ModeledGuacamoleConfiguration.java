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
import java.util.Map;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Implementation of GuacamoleConfiguration which loads parameter values only
 * if necessary, and only if allowed.
 */
public class ModeledGuacamoleConfiguration extends GuacamoleConfiguration {

    /**
     * The user this configuration belongs to. Access is based on his/her
     * permission settings.
     */
    private ModeledAuthenticatedUser currentUser;

    /**
     * The internal model object containing the values which represent the
     * connection associated with this configuration.
     */
    private ConnectionModel connectionModel;

    /**
     * Service for managing connection parameters.
     */
    @Inject
    private ConnectionService connectionService;

    /**
     * The manually-set parameter map, if any.
     */
    private Map<String, String> parameters = null;
    
    /**
     * Creates a new, empty ModelGuacamoleConfiguration.
     */
    public ModeledGuacamoleConfiguration() {
    }

    /**
     * Initializes this configuration, associating it with the current
     * authenticated user and populating it with data from the given model
     * object.
     *
     * @param currentUser
     *     The user that created or retrieved this configuration.
     *
     * @param connectionModel 
     *     The model object backing this configuration.
     */
    public void init(ModeledAuthenticatedUser currentUser, ConnectionModel connectionModel) {
        this.currentUser = currentUser;
        this.connectionModel = connectionModel;
    }

    @Override
    public String getProtocol() {
        return connectionModel.getProtocol();
    }

    @Override
    public void setProtocol(String protocol) {
        super.setProtocol(protocol);
        connectionModel.setProtocol(protocol);
    }


    @Override
    public void setParameters(Map<String, String> parameters) {
        this.parameters = parameters;
        super.setParameters(parameters);
    }

    @Override
    public Map<String, String> getParameters() {

        // Retrieve visible parameters, if not overridden by setParameters()
        if (parameters == null) {

            // Retrieve all visible parameters
            Map<String, String> visibleParameters =
                    connectionService.retrieveParameters(currentUser, connectionModel.getIdentifier());

            // Use retrieved parameters to back future operations
            super.setParameters(visibleParameters);

        }

        return super.getParameters();

    }

}
