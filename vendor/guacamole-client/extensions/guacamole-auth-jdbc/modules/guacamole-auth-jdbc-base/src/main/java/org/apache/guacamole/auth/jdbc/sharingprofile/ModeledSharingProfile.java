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

package org.apache.guacamole.auth.jdbc.sharingprofile;

import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import org.apache.guacamole.auth.jdbc.base.ModeledChildDirectoryObject;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.SharingProfile;

/**
 * An implementation of the SharingProfile object which is backed by a database
 * model.
 */
public class ModeledSharingProfile
        extends ModeledChildDirectoryObject<SharingProfileModel>
        implements SharingProfile {

    /**
     * All possible attributes of sharing profile objects organized as
     * individual, logical forms. Currently, there are no such attributes.
     */
    public static final Collection<Form> ATTRIBUTES = Collections.<Form>emptyList();

    /**
     * The manually-set parameter map, if any.
     */
    private Map<String, String> parameters = null;

    /**
     * Service for managing sharing profiles.
     */
    @Inject
    private SharingProfileService sharingProfileService;

    /**
     * Creates a new, empty ModeledSharingProfile.
     */
    public ModeledSharingProfile() {
    }

    @Override
    public String getName() {
        return getModel().getName();
    }

    @Override
    public void setName(String name) {
        getModel().setName(name);
    }

    @Override
    public String getPrimaryConnectionIdentifier() {
        return getModel().getParentIdentifier();
    }

    @Override
    public void setPrimaryConnectionIdentifier(String identifier) {
        getModel().setParentIdentifier(identifier);
    }

    @Override
    public Map<String, String> getParameters() {

        // Retrieve visible parameters, if not overridden by setParameters()
        if (parameters == null)
            return sharingProfileService.retrieveParameters(getCurrentUser(),
                    getModel().getIdentifier());

        return parameters;

    }

    @Override
    public void setParameters(Map<String, String> parameters) {
        this.parameters = parameters;
    }

}
