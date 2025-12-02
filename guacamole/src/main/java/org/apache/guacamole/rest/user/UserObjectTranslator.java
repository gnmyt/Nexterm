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

package org.apache.guacamole.rest.user;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * Translator which converts between User objects and APIUser objects.
 */
public class UserObjectTranslator
        extends DirectoryObjectTranslator<User, APIUser> {

    @Override
    public APIUser toExternalObject(User object)
            throws GuacamoleException {
        return new APIUser(object);
    }

    @Override
    public User toInternalObject(APIUser object)
            throws GuacamoleException {
        return new APIUserWrapper(object);
    }

    @Override
    public void applyExternalChanges(User existingObject,
            APIUser object) throws GuacamoleException {

        // Do not update the user password if no password was provided
        if (object.getPassword() != null)
            existingObject.setPassword(object.getPassword());
        
        // Update disabled status
        existingObject.setDisabled(object.isDisabled());

        // Update user attributes
        existingObject.setAttributes(object.getAttributes());

    }

    @Override
    public void filterExternalObject(UserContext userContext, APIUser object)
            throws GuacamoleException {

        // If a user is editing themselves ...
        if (object.getUsername().equals(userContext.self().getIdentifier())) {

            // ... they may only edit preference attributes
            object.setAttributes(filterAttributes(userContext.getUserPreferenceAttributes(),
                    object.getAttributes()));

        }

        else {

            // In all other cases, filter object attributes by defined schema
            object.setAttributes(filterAttributes(userContext.getUserAttributes(),
                    object.getAttributes()));

        }

    }

}
