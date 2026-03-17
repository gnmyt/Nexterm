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

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.PasswordField;
import org.apache.guacamole.form.UsernameField;

/**
 * Information which describes a set of valid credentials.
 */
public class CredentialsInfo {

    /**
     * All fields required for valid credentials.
     */
    private final Collection<Field> fields;

    /**
     * Creates a new CredentialsInfo object which requires the given fields for
     * any conforming credentials.
     *
     * @param fields
     *     The fields to require.
     */
    public CredentialsInfo(Collection<Field> fields) {
        this.fields = fields;
    }
    
    /**
     * Returns all fields required for valid credentials as described by this
     * object.
     *
     * @return
     *     All fields required for valid credentials.
     */
    public Collection<Field> getFields() {
        return Collections.unmodifiableCollection(fields);
    }

    /**
     * CredentialsInfo object which describes empty credentials. No fields are
     * required.
     */
    public static final CredentialsInfo EMPTY = new CredentialsInfo(Collections.<Field>emptyList());

    /**
     * A field describing the username HTTP parameter expected by Guacamole
     * during login, if usernames are being used.
     */
    public static final Field USERNAME = new UsernameField("username");

    /**
     * A field describing the password HTTP parameter expected by Guacamole
     * during login, if passwords are being used.
     */
    public static final Field PASSWORD = new PasswordField("password");

    /**
     * CredentialsInfo object which describes standard username/password
     * credentials.
     */
    public static final CredentialsInfo USERNAME_PASSWORD = new CredentialsInfo(Arrays.asList(
        USERNAME,
        PASSWORD
    ));
    
}
