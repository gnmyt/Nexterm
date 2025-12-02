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

package org.apache.guacamole.rest.activeconnection;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * Translator which converts between ActiveConnection objects and
 * APIActiveConnection objects. As ActiveConnection objects are read-only, only
 * toExternalObject() is implemented here.
 */
public class ActiveConnectionObjectTranslator
        extends DirectoryObjectTranslator<ActiveConnection, APIActiveConnection> {

    @Override
    public APIActiveConnection toExternalObject(ActiveConnection object)
            throws GuacamoleException {
        return new APIActiveConnection(object);
    }

    @Override
    public ActiveConnection toInternalObject(APIActiveConnection object)
            throws GuacamoleException {

        // ActiveConnection objects are read-only
        throw new GuacamoleUnsupportedException("Active connection records are read-only.");

    }

    @Override
    public void applyExternalChanges(ActiveConnection existingObject,
            APIActiveConnection object) throws GuacamoleException {

        // Modification not supported for ActiveConnection
        throw new GuacamoleUnsupportedException("Active connection records are read-only.");

    }

    @Override
    public void filterExternalObject(UserContext context,
            APIActiveConnection object) throws GuacamoleException {
        // Nothing to filter on ActiveConnections (no attributes)
    }

}
