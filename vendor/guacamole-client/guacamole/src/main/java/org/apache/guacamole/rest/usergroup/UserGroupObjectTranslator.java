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

package org.apache.guacamole.rest.usergroup;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * Translator which converts between UserGroup objects and APIUserGroup
 * objects.
 */
public class UserGroupObjectTranslator
        extends DirectoryObjectTranslator<UserGroup, APIUserGroup> {

    @Override
    public APIUserGroup toExternalObject(UserGroup object)
            throws GuacamoleException {
        return new APIUserGroup(object);
    }

    @Override
    public UserGroup toInternalObject(APIUserGroup object)
            throws GuacamoleException {
        return new APIUserGroupWrapper(object);
    }

    @Override
    public void applyExternalChanges(UserGroup existingObject,
            APIUserGroup object) throws GuacamoleException {

        // Update disabled status
        existingObject.setDisabled(object.isDisabled());
        
        // Update user attributes
        existingObject.setAttributes(object.getAttributes());

    }

    @Override
    public void filterExternalObject(UserContext userContext, APIUserGroup object)
            throws GuacamoleException {

        // Filter object attributes by defined schema
        object.setAttributes(filterAttributes(userContext.getUserGroupAttributes(),
                object.getAttributes()));

    }

}
