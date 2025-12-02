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

import java.util.Collection;
import java.util.Map;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.net.auth.credentials.UserCredentials;

/**
 * The object returned by REST API calls to define a full set of valid
 * credentials, including field definitions and corresponding expected
 * values.
 */
public class APIUserCredentials {

    /**
     * All expected request parameters, if any, as a collection of fields.
     */
    private final Collection<Field> expected;

    /**
     * A map of all field values by field name.
     */
    private final Map<String, String> values;

    /**
     * Creates a new APIUserCredentials object whose required parameters and
     * corresponding values are defined by the given UserCredentials.
     *
     * @param userCredentials
     *     The UserCredentials which defines the parameters and corresponding
     *     values of this APIUserCredentials.
     */
    public APIUserCredentials(UserCredentials userCredentials) {
        this.expected = userCredentials.getFields();
        this.values = userCredentials.getValues();
    }

    /**
     * Returns a collection of all required parameters, where each parameter is
     * represented by a field.
     *
     * @return
     *     A collection of all required parameters.
     */
    public Collection<Field> getExpected() {
        return expected;
    }

    /**
     * Returns a map of all field values by field name. The fields having the
     * names used within this map should be defined within the collection of
     * required parameters returned by getExpected().
     *
     * @return
     *     A map of all field values by field name.
     */
    public Map<String, String> getValues() {
        return values;
    }

}
