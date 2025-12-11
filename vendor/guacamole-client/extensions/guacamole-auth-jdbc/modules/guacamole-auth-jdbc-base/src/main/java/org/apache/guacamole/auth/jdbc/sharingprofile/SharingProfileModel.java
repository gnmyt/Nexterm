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

import org.apache.guacamole.auth.jdbc.base.ChildObjectModel;

/**
 * Object representation of a Guacamole sharing profile, as represented in the
 * database.
 */
public class SharingProfileModel extends ChildObjectModel {

    /**
     * The human-readable name associated with this sharing profile.
     */
    private String name;

    /**
     * Creates a new, empty sharing profile.
     */
    public SharingProfileModel() {
    }

    /**
     * Returns the name associated with this sharing profile.
     *
     * @return
     *     The name associated with this sharing profile.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name associated with this sharing profile.
     *
     * @param name
     *     The name to associate with this sharing profile.
     */
    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String getIdentifier() {

        // If no associated ID, then no associated identifier
        Integer id = getObjectID();
        if (id == null)
            return null;

        // Otherwise, the identifier is the ID as a string
        return id.toString();

    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Sharing profile identifiers "
                + "are derived from IDs. They cannot be set.");
    }

}
