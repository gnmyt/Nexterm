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

import java.text.ParseException;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.filter.FilterParser;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.properties.GuacamoleProperty;

/**
 * A GuacamoleProperty with a value of an ExprNode query filter.  The string
 * provided is passed through the FilterParser returning the ExprNode object,
 * or an exception is thrown if the filter is invalid and cannot be correctly
 * parsed.
 */
public abstract class LdapFilterGuacamoleProperty implements GuacamoleProperty<ExprNode> {

    @Override
    public ExprNode parseValue(String value) throws GuacamoleException {

        // No value provided, so return null.
        if (value == null)
            return null;

        try {
            return FilterParser.parse(value);
        }
        catch (ParseException e) {
            throw new GuacamoleServerException("\"" + value + "\" is not a valid LDAP filter.", e);
        }

    }

}
