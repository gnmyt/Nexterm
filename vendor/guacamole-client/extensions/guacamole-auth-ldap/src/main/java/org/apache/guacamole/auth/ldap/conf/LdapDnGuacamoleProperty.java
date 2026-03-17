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

package org.apache.guacamole.auth.ldap.conf;

import org.apache.directory.api.ldap.model.exception.LdapInvalidDnException;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.properties.GuacamoleProperty;

/**
 * A GuacamoleProperty that converts a string to a Dn that can be used
 * in LDAP connections.  An exception is thrown if the provided DN is invalid
 * and cannot be parsed.
 */
public abstract class LdapDnGuacamoleProperty implements GuacamoleProperty<Dn> {

    @Override
    public Dn parseValue(String value) throws GuacamoleException {

        if (value == null)
            return null;

        try {
            return new Dn(value);
        }
        catch (LdapInvalidDnException e) {
            throw new GuacamoleServerException("The DN \"" + value + "\" is invalid.", e);
        }

    }

}