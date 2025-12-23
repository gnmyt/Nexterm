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

package org.apache.guacamole.auth.jdbc.security;

import java.util.Collections;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * Thrown when an attempt is made to set a user's password to a string which is
 * too short, in violation of the defined password policy.
 */
public class PasswordMinimumLengthException extends PasswordPolicyException {

    /**
     * Creates a new PasswordMinimumLengthException with the given
     * human-readable message. The translatable message is already defined.
     *
     * @param message
     *     A human-readable message describing the password policy violation
     *     that occurred.
     *
     * @param length
     *     The minimum length that passwords must have to avoid violating
     *     policy, in characters.
     */
    public PasswordMinimumLengthException(String message, int length) {
        super(message, new TranslatableMessage(
            "PASSWORD_POLICY.ERROR_TOO_SHORT",
            Collections.singletonMap("LENGTH", length)
        ));
    }

}
