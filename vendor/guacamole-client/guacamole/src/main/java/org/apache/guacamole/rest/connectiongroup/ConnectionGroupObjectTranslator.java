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

package org.apache.guacamole.rest.connectiongroup;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * Translator which converts between ConnectionGroup objects and
 * APIConnectionGroup objects.
 */
public class ConnectionGroupObjectTranslator
        extends DirectoryObjectTranslator<ConnectionGroup, APIConnectionGroup> {

    @Override
    public APIConnectionGroup toExternalObject(ConnectionGroup object)
            throws GuacamoleException {
        return new APIConnectionGroup(object);
    }

    @Override
    public ConnectionGroup toInternalObject(APIConnectionGroup object) {
        return new APIConnectionGroupWrapper(object);
    }

    @Override
    public void applyExternalChanges(ConnectionGroup existingObject,
            APIConnectionGroup object) {

        // Update the connection group
        existingObject.setName(object.getName());
        existingObject.setParentIdentifier(object.getParentIdentifier());
        existingObject.setType(object.getType());
        existingObject.setAttributes(object.getAttributes());

    }

    @Override
    public void filterExternalObject(UserContext userContext,
            APIConnectionGroup object) throws GuacamoleException {

        // Filter object attributes by defined schema
        object.setAttributes(filterAttributes(
                userContext.getConnectionGroupAttributes(),
                object.getAttributes()));

    }

}
