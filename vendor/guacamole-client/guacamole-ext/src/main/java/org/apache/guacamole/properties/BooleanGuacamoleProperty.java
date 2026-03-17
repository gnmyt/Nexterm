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

package org.apache.guacamole.properties;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * A GuacamoleProperty whose value is an boolean. Legal true values are "true",
 * or "false". Case does not matter.
 */
public abstract class BooleanGuacamoleProperty implements GuacamoleProperty<Boolean> {

    @Override
    public Boolean parseValue(String value) throws GuacamoleException {

        // If no property provided, return null.
        if (value == null)
            return null;

        // If "true", return true
        if (value.equalsIgnoreCase("true"))
            return true;

        // If "false", return false
        if (value.equalsIgnoreCase("false"))
            return false;

        // Otherwise, fail
        throw new GuacamoleServerException("Property \"" + getName()
                + "\" must be either \"true\" or \"false\".");

    }

}
