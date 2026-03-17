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

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import java.util.Map;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * A REST resource which abstracts the operations available on an existing
 * SharingProfile.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SharingProfileResource
        extends DirectoryObjectResource<SharingProfile, APISharingProfile> {

    /**
     * Creates a new SharingProfileResource which exposes the operations and
     * subresources available for the given SharingProfile.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given SharingProfile.
     *
     * @param sharingProfile
     *     The SharingProfile that this SharingProfileResource should represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles the type of
     *     object given.
     */
    @AssistedInject
    public SharingProfileResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<SharingProfile> directory,
            @Assisted SharingProfile sharingProfile,
            DirectoryObjectTranslator<SharingProfile, APISharingProfile> translator) {
        super(authenticatedUser, userContext, SharingProfile.class, directory, sharingProfile, translator);
    }

    /**
     * Retrieves the connection parameters associated with the SharingProfile
     * exposed by this SharingProfile resource.
       *
     * @return
     *     A map of parameter name/value pairs.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the connection parameters of the
     *     SharingProfile.
     */
    @GET
    @Path("parameters")
    public Map<String, String> getParameters()
            throws GuacamoleException {

        SharingProfile sharingProfile = getInternalObject();
        
        // Pull effective permissions
        Permissions effective = getUserContext().self().getEffectivePermissions();

        // Retrieve permission sets
        SystemPermissionSet systemPermissions = effective.getSystemPermissions();
        ObjectPermissionSet sharingProfilePermissions = effective.getSharingProfilePermissions();

        // Deny access if adminstrative or update permission is missing
        String identifier = sharingProfile.getIdentifier();
        if (!systemPermissions.hasPermission(SystemPermission.Type.ADMINISTER)
         && !sharingProfilePermissions.hasPermission(ObjectPermission.Type.UPDATE, identifier))
            throw new GuacamoleSecurityException("Permission to read sharing profile parameters denied.");

        // Return parameter map
        return sharingProfile.getParameters();

    }

}
