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

import java.util.Map;

/**
 * SharingProfile implementation which simply delegates all function calls to an
 * underlying SharingProfile.
 */
public class DelegatingSharingProfile implements SharingProfile {

    /**
     * The wrapped SharingProfile.
     */
    private final SharingProfile sharingProfile;

    /**
     * Wraps the given SharingProfile such that all function calls against this
     * DelegatingSharingProfile will be delegated to it.
     *
     * @param sharingProfile
     *     The SharingProfile to wrap.
     */
    public DelegatingSharingProfile(SharingProfile sharingProfile) {
        this.sharingProfile = sharingProfile;
    }

    /**
     * Returns the underlying SharingProfile wrapped by this
     * DelegatingSharingProfile.
     *
     * @return
     *     The SharingProfile wrapped by this DelegatingSharingProfile.
     */
    protected SharingProfile getDelegateSharingProfile() {
        return sharingProfile;
    }

    @Override
    public String getIdentifier() {
        return sharingProfile.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        sharingProfile.setIdentifier(identifier);
    }

    @Override
    public String getName() {
        return sharingProfile.getName();
    }

    @Override
    public void setName(String name) {
        sharingProfile.setName(name);
    }

    @Override
    public String getPrimaryConnectionIdentifier() {
        return sharingProfile.getPrimaryConnectionIdentifier();
    }

    @Override
    public void setPrimaryConnectionIdentifier(String identifier) {
        sharingProfile.setPrimaryConnectionIdentifier(identifier);
    }

    @Override
    public Map<String, String> getParameters() {
        return sharingProfile.getParameters();
    }

    @Override
    public void setParameters(Map<String, String> parameters) {
        sharingProfile.setParameters(parameters);
    }

    @Override
    public Map<String, String> getAttributes() {
        return sharingProfile.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        sharingProfile.setAttributes(attributes);
    }

}
