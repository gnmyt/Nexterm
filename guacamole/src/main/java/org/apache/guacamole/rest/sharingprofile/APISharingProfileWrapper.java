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

package org.apache.guacamole.rest.sharingprofile;

import java.util.Map;
import org.apache.guacamole.net.auth.SharingProfile;

/**
 * Wrapper for APISharingProfile which provides a SharingProfile interface.
 * Changes to the underlying APISharingProfile are reflected immediately in the
 * values exposed by the SharingProfile interface, and changes made through the
 * SharingProfile interface immediately affect the underlying APISharingProfile.
 */
public class APISharingProfileWrapper implements SharingProfile {

    /**
     * The wrapped APISharingProfile.
     */
    private final APISharingProfile apiSharingProfile;

    /**
     * Creates a new APISharingProfileWrapper which is backed by the given
     * APISharingProfile.
     *
     * @param apiSharingProfile
     *     The APISharingProfile to wrap.
     */
    public APISharingProfileWrapper(APISharingProfile apiSharingProfile) {
        this.apiSharingProfile = apiSharingProfile;
    }

    @Override
    public String getName() {
        return apiSharingProfile.getName();
    }

    @Override
    public void setName(String name) {
        apiSharingProfile.setName(name);
    }

    @Override
    public String getIdentifier() {
        return apiSharingProfile.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        apiSharingProfile.setIdentifier(identifier);
    }

    @Override
    public String getPrimaryConnectionIdentifier() {
        return apiSharingProfile.getPrimaryConnectionIdentifier();
    }

    @Override
    public void setPrimaryConnectionIdentifier(String primaryConnectionIdentifier) {
        apiSharingProfile.setPrimaryConnectionIdentifier(primaryConnectionIdentifier);
    }

    @Override
    public Map<String, String> getParameters() {
        return apiSharingProfile.getParameters();
    }

    @Override
    public void setParameters(Map<String, String> parameters) {
        apiSharingProfile.setParameters(parameters);
    }

    @Override
    public Map<String, String> getAttributes() {
        return apiSharingProfile.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        apiSharingProfile.setAttributes(attributes);
    }

}
