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

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * Translator which converts between SharingProfile objects and
 * APISharingProfile objects.
 */
public class SharingProfileObjectTranslator
        extends DirectoryObjectTranslator<SharingProfile, APISharingProfile> {

    @Override
    public APISharingProfile toExternalObject(SharingProfile object)
            throws GuacamoleException {
        return new APISharingProfile(object);
    }

    @Override
    public SharingProfile toInternalObject(APISharingProfile object) {
        return new APISharingProfileWrapper(object);
    }

    @Override
    public void applyExternalChanges(SharingProfile existingObject,
            APISharingProfile object) {

        // Update the sharing profile
        existingObject.setPrimaryConnectionIdentifier(object.getPrimaryConnectionIdentifier());
        existingObject.setName(object.getName());
        existingObject.setParameters(object.getParameters());
        existingObject.setAttributes(object.getAttributes());

    }

    @Override
    public void filterExternalObject(UserContext userContext,
            APISharingProfile object) throws GuacamoleException {

        // Filter object attributes by defined schema
        object.setAttributes(filterAttributes(
                userContext.getSharingProfileAttributes(),
                object.getAttributes()));

    }

}
