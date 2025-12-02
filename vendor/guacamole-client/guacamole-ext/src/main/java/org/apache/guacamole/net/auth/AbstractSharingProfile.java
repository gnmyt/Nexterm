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

import java.util.HashMap;
import java.util.Map;

/**
 * Base implementation of a sharing profile which can be used to share a
 * Guacamole connection.
 */
public abstract class AbstractSharingProfile implements SharingProfile {

    /**
     * The human-readable name of this sharing profile.
     */
    private String name;

    /**
     * The unique identifier associated with this sharing profile.
     */
    private String identifier;

    /**
     * The identifier of the primary connection that this sharing profile can
     * be used to share.
     */
    private String primaryConnectionIdentifier;

    /**
     * All connection parameters with this sharing profile.
     */
    private final Map<String, String> parameters = new HashMap<String, String>();

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String getIdentifier() {
        return identifier;
    }

    @Override
    public void setIdentifier(String identifier) {
        this.identifier = identifier;
    }

    @Override
    public String getPrimaryConnectionIdentifier() {
        return primaryConnectionIdentifier;
    }

    @Override
    public void setPrimaryConnectionIdentifier(String primaryConnectionIdentifier) {
        this.primaryConnectionIdentifier = primaryConnectionIdentifier;
    }

    @Override
    public Map<String, String> getParameters() {
        return parameters;
    }

    @Override
    public void setParameters(Map<String, String> parameters) {
        this.parameters.clear();
        this.parameters.putAll(parameters);
    }

    @Override
    public int hashCode() {
        if (identifier == null) return 0;
        return identifier.hashCode();
    }

    @Override
    public boolean equals(Object obj) {

        // Not equal if null or not an SharingProfile
        if (obj == null) return false;
        if (!(obj instanceof AbstractSharingProfile)) return false;

        // Get identifier
        String objIdentifier = ((AbstractSharingProfile) obj).identifier;

        // If null, equal only if this identifier is null
        if (objIdentifier == null) return identifier == null;

        // Otherwise, equal only if strings are identical
        return objIdentifier.equals(identifier);

    }

}
