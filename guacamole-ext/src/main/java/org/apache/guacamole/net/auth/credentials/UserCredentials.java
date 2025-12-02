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

package org.apache.guacamole.net.auth.credentials;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.form.Field;

/**
 * A fully-valid set of credentials and associated values. Each instance of
 * this object should describe a full set of parameter name/value pairs which
 * can be used to authenticate successfully, even if that success depends on
 * factors not described by this object.
 */
public class UserCredentials extends CredentialsInfo {

    /**
     * All fields required for valid credentials.
     */
    private Map<String, String> values;

    /**
     * Creates a new UserCredentials object which requires the given fields and
     * values.
     *
     * @param fields
     *     The fields to require.
     *
     * @param values
     *     The values required for each field, as a map of field name to
     *     correct value.
     */
    public UserCredentials(Collection<Field> fields, Map<String, String> values) {
        super(fields);
        this.values = values;
    }

    /**
     * Creates a new UserCredentials object which requires fields described by
     * the given CredentialsInfo. The value required for each field in the
     * CredentialsInfo is defined in the given Map.
     *
     * @param info
     *     The CredentialsInfo object describing the fields to require.
     *
     * @param values
     *     The values required for each field, as a map of field name to
     *     correct value.
     */
    public UserCredentials(CredentialsInfo info, Map<String, String> values) {
        this(info.getFields(), values);
    }

    /**
     * Creates a new UserCredentials object which requires fields described by
     * the given CredentialsInfo but does not yet have any defined values.
     *
     * @param info
     *     The CredentialsInfo object describing the fields to require.
     */
    public UserCredentials(CredentialsInfo info) {
        this(info, new HashMap<String, String>());
    }

    /**
     * Creates a new UserCredentials object which requires the given fields but
     * does not yet have any defined values.
     *
     * @param fields
     *     The fields to require.
     */
    public UserCredentials(Collection<Field> fields) {
        this(fields, new HashMap<String, String>());
    }

    /**
     * Returns a map of field names to values which backs this UserCredentials
     * object. Modifications to the returned map will directly affect the
     * associated name/value pairs.
     *
     * @return
     *     A map of field names to their corresponding values which backs this
     *     UserCredentials object.
     */
    public Map<String, String> getValues() {
        return values;
    }

    /**
     * Replaces the map backing this UserCredentials object with the given map.
     * All field name/value pairs described by the original map are replaced by
     * the name/value pairs in the given map.
     *
     * @param values
     *     The map of field names to their corresponding values which should be
     *     used to back this UserCredentials object.
     */
    public void setValues(Map<String, String> values) {
        this.values = values;
    }

    /**
     * Returns the value defined by this UserCrendentials object for the field
     * having the given name.
     *
     * @param name
     *     The name of the field whose value should be returned.
     *
     * @return
     *     The value of the field having the given name, or null if no value is
     *     defined for that field.
     */
    public String getValue(String name) {
        return values.get(name);
    }

    /**
     * Returns the value defined by this UserCrendentials object for the given
     * field.
     *
     * @param field
     *     The field whose value should be returned.
     *
     * @return
     *     The value of the given field, or null if no value is defined for
     *     that field.
     */
    public String getValue(Field field) {
        return getValue(field.getName());
    }

    /**
     * Sets the value of the field having the given name. Any existing value
     * for that field is replaced.
     *
     * @param name
     *     The name of the field whose value should be assigned.
     *
     * @param value
     *     The value to assign to the field having the given name.
     *
     * @return
     *     The previous value of the field, or null if the value of the field
     *     was not previously defined.
     */
    public String setValue(String name, String value) {
        return values.put(name, value);
    }

    /**
     * Sets the value of the given field. Any existing value for that field is
     * replaced.
     *
     * @param field
     *     The field whose value should be assigned.
     *
     * @param value
     *     The value to assign to the given field.
     *
     * @return
     *     The previous value of the field, or null if the value of the field
     *     was not previously defined.
     */
    public String setValue(Field field, String value) {
        return setValue(field.getName(), value);
    }

    /**
     * Removes (undefines) the value of the field having the given name,
     * returning its previous value. If the field value was not defined, this
     * function has no effect, and null is returned.
     *
     * @param name
     *     The name of the field whose value should be removed.
     *
     * @return
     *     The previous value of the field, or null if the value of the field
     *     was not previously defined.
     */
    public String removeValue(String name) {
        return values.remove(name);
    }

    /**
     * Removes (undefines) the value of the given field returning its previous
     * value. If the field value was not defined, this function has no effect,
     * and null is returned.
     *
     * @param field
     *     The field whose value should be removed.
     *
     * @return
     *     The previous value of the field, or null if the value of the field
     *     was not previously defined.
     */
    public String removeValue(Field field) {
        return removeValue(field.getName());
    }

}
