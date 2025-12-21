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
 * Thrown when an attempt is made to reuse a previous password, in violation of
 * the defined password policy.
 */
public class PasswordReusedException extends PasswordPolicyException {

    /**
     * Creates a new PasswordReusedException with the given human-readable
     * message. The translatable message is already defined.
     *
     * @param message
     *     A human-readable message describing the password policy violation
     *     that occurred.
     *
     * @param historySize
     *     The number of previous passwords which are remembered for each user,
     *     and must not be reused.
     */
    public PasswordReusedException(String message, int historySize) {
        super(message, new TranslatableMessage(
            "PASSWORD_POLICY.ERROR_REUSED",
            Collections.singletonMap("HISTORY_SIZE", historySize)
        ));
    }

}
