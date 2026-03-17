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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.Map;
import org.apache.guacamole.net.auth.SharingProfile;

/**
 * The external representation used by the REST API for sharing profiles.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(value=Include.NON_NULL)
public class APISharingProfile {

    /**
     * The human-readable name of this sharing profile.
     */
    private String name;
    
    /**
     * The unique string which identifies this sharing profile within its
     * containing directory.
     */
    private String identifier;
    
    /**
     * The identifier of the primary connection that this sharing profile
     * can be used to share.
     */
    private String primaryConnectionIdentifier;

    /**
     * Map of all associated connection parameter values which apply when the
     * sharing profile is used, indexed by parameter name.
     */
    private Map<String, String> parameters;
    
    /**
     * Map of all associated attributes by attribute identifier.
     */
    private Map<String, String> attributes;

    /**
     * Creates an empty, uninitialized APISharingProfile. The properties of the
     * created APISharingProfile will need to be set individually as necessary
     * via their corresponding setters.
     */
    public APISharingProfile() {}
    
    /**
     * Creates a new APISharingProfile with its data populated from that of an
     * existing SharingProfile. As the connection parameters of the
     * SharingProfile are potentially sensitive, they will not be included in
     * the new APISharingProfile.
     *
     * @param sharingProfile
     *     The sharing profile to use to populate the data of the new
     *     APISharingProfile.
     */
    public APISharingProfile(SharingProfile sharingProfile) {

        // Set main information
        this.name = sharingProfile.getName();
        this.identifier = sharingProfile.getIdentifier();
        this.primaryConnectionIdentifier = sharingProfile.getPrimaryConnectionIdentifier();
        
        // Associate any attributes
        this.attributes = sharingProfile.getAttributes();

    }

    /**
     * Returns the human-readable name of this sharing profile.
     *
     * @return
     *     The human-readable name of this sharing profile.
     */
    public String getName() {
        return name;
    }

    /**
     * Set the human-readable name of this sharing profile.
     *
     * @param name
     *     The human-readable name of this sharing profile.
     */
    public void setName(String name) {
        this.name = name;
    }
    
    /**
     * Returns the unique string which identifies this sharing profile within
     * its containing directory.
     *
     * @return
     *     The unique string which identifies this sharing profile within its
     *     containing directory.
     */
    public String getIdentifier() {
        return identifier;
    }

    /**
     * Sets the unique string which identifies this sharing profile within
     * its containing directory.
     *
     * @param identifier
     *     The unique string which identifies this sharing profile within its
     *     containing directory.
     */
    public void setIdentifier(String identifier) {
        this.identifier = identifier;
    }
    
    /**
     * Returns the identifier of the primary connection that this sharing
     * profile can be used to share.
     *
     * @return
     *     The identifier of the primary connection that this sharing profile
     *     can be used to share.
     */
    public String getPrimaryConnectionIdentifier() {
        return primaryConnectionIdentifier;
    }

    /**
     * Sets the identifier of the primary connection that this sharing profile
     * can be used to share.
     *
     * @param primaryConnectionIdentifier
     *     The identifier of the primary connection that this sharing profile
     *     can be used to share.
     */
    public void setPrimaryConnectionIdentifier(String primaryConnectionIdentifier) {
        this.primaryConnectionIdentifier = primaryConnectionIdentifier;
    }

    /**
     * Returns a map of all associated connection parameter values which apply
     * when the sharing profile is used, indexed by parameter name.
     *
     * @return
     *     A map of all associated connection parameter values which apply when
     *     the sharing profile is used, indexed by parameter name.
     */
    public Map<String, String> getParameters() {
        return parameters;
    }

    /**
     * Sets the map of all associated connection parameter values which apply
     * when the sharing profile is used, indexed by parameter name.
     *
     * @param parameters
     *     The map of all associated connection parameter values which apply
     *     when the sharing profile is used, indexed by parameter name.
     */
    public void setParameters(Map<String, String> parameters) {
        this.parameters = parameters;
    }

    /**
     * Returns a map of all attributes associated with this sharing profile.
     * Each entry key is the attribute identifier, while each value is the
     * attribute value itself.
     *
     * @return
     *     The attribute map for this sharing profile.
     */
    public Map<String, String> getAttributes() {
        return attributes;
    }

    /**
     * Sets the map of all attributes associated with this sharing profile. Each
     * entry key is the attribute identifier, while each value is the attribute
     * value itself.
     *
     * @param attributes
     *     The attribute map for this sharing profile.
     */
    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes;
    }

}
