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

package org.apache.guacamole.protocol;


import java.io.Serializable;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * All information necessary to complete the initial protocol handshake of a
 * Guacamole session.
 */
public class GuacamoleConfiguration implements Serializable {

    /**
     * Identifier unique to this version of GuacamoleConfiguration.
     */
    private static final long serialVersionUID = 1L;

    /**
     * The ID of the connection being joined. If this value is present,
     * the protocol need not be specified.
     */
    private String connectionID;
    
    /**
     * The name of the protocol associated with this configuration.
     */
    private String protocol;

    /**
     * Map of all associated parameter values, indexed by parameter name.
     */
    private final Map<String, String> parameters = new HashMap<String, String>();

    /**
     * Creates a new, blank GuacamoleConfiguration with its protocol, connection
     * ID, and parameters unset.
     */
    public GuacamoleConfiguration() {
    }

    /**
     * Copies the given GuacamoleConfiguration, creating a new, indepedent
     * GuacamoleConfiguration containing the same protocol, connection ID,
     * and parameter values, if any.
     *
     * @param config The GuacamoleConfiguration to copy.
     */
    public GuacamoleConfiguration(GuacamoleConfiguration config) {

        // Copy protocol and connection ID
        protocol = config.getProtocol();
        connectionID = config.getConnectionID();

        // Copy parameter values
        for (String name : config.getParameterNames())
            parameters.put(name, config.getParameter(name));

    }

    /**
     * Returns the ID of the connection being joined, if any. If no connection
     * is being joined, this returns null, and the protocol must be set.
     *
     * @return The ID of the connection being joined, or null if no connection
     *         is being joined.
     */
    public String getConnectionID() {
        return connectionID;
    }

    /**
     * Sets the ID of the connection being joined, if any. If no connection
     * is being joined, this value must be omitted.
     *
     * @param connectionID The ID of the connection being joined.
     */
    public void setConnectionID(String connectionID) {
        this.connectionID = connectionID;
    }

    /**
     * Returns the name of the protocol to be used.
     *
     * @return
     *     The name of the protocol to be used.
     */
    public String getProtocol() {
        return protocol;
    }

    /**
     * Sets the name of the protocol to be used. If no connection is being
     * joined (a new connection is being established), this value must be set.
     *
     * <p>If a connection is being joined, <strong>this value should still be
     * set</strong> to ensure that protocol-specific responses like the
     * "required" and "argv" instructions can be understood in their proper
     * context by other code that may consume this GuacamoleConfiguration like
     * {@link ConfiguredGuacamoleSocket}.
     *
     * <p>If this value is unavailable or remains unset, it is still possible
     * to join an established connection using
     * {@link #setConnectionID(java.lang.String)}, however protocol-specific
     * responses like the "required" and "argv" instructions might not be
     * possible to handle correctly if the underlying protocol is not made
     * available through some other means to the client receiving those
     * responses.
     *
     * @param protocol
     *    The name of the protocol to be used.
     */
    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    /**
     * Returns the value set for the parameter with the given name, if any.
     * @param name The name of the parameter to return the value for.
     * @return The value of the parameter with the given name, or null if
     *         that parameter has not been set.
     */
    public String getParameter(String name) {
        return parameters.get(name);
    }

    /**
     * Sets the value for the parameter with the given name.
     *
     * @param name The name of the parameter to set the value for.
     * @param value The value to set for the parameter with the given name.
     */
    public void setParameter(String name, String value) {
        parameters.put(name, value);
    }

    /**
     * Removes the value set for the parameter with the given name.
     *
     * @param name The name of the parameter to remove the value of.
     */
    public void unsetParameter(String name) {
        parameters.remove(name);
    }

    /**
     * Returns a set of all currently defined parameter names. Each name
     * corresponds to a parameter that has a value set on this
     * GuacamoleConfiguration via setParameter().
     *
     * @return A set of all currently defined parameter names.
     */
    public Set<String> getParameterNames() {
        return Collections.unmodifiableSet(parameters.keySet());
    }

    /**
     * Returns a map which contains parameter name/value pairs as key/value
     * pairs. Changes to this map will affect the parameters stored within
     * this configuration.
     *
     * @return
     *     A map which contains all parameter name/value pairs as key/value
     *     pairs.
     */
    public Map<String, String> getParameters() {
        return parameters;
    }

    /**
     * Replaces all current parameters with the parameters defined within the
     * given map. Key/value pairs within the map represent parameter name/value
     * pairs.
     *
     * @param parameters
     *     A map which contains all parameter name/value pairs as key/value
     *     pairs.
     */
    public void setParameters(Map<String, String> parameters) {
        this.parameters.clear();
        this.parameters.putAll(parameters);
    }

}
