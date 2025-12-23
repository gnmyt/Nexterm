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

import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.language.Translatable;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * Thrown when an attempt to change a user's password fails due to a violation
 * of password complexity policies.
 */
public class PasswordPolicyException extends GuacamoleClientException
    implements Translatable {

    /**
     * A translatable message which, after being passed through the translation
     * system, describes the policy violation that occurred.
     */
    private final TranslatableMessage translatableMessage;

    /**
     * Creates a new PasswordPolicyException with the given human-readable
     * message (which will not be passed through the translation system) and
     * translation string key(which WILL be passed through the translation
     * system), both of which should describe the policy violation that
     * occurred.
     *
     * @param message
     *     A human-readable message describing the policy violation that
     *     occurred.
     *
     * @param translationKey
     *     The key of a translation string known to the translation system
     *     which describes the policy violation that occurred.
     */
    public PasswordPolicyException(String message, String translationKey) {
        super(message);
        this.translatableMessage = new TranslatableMessage(translationKey);
    }

    /**
     * Creates a new PasswordPolicyException with the given human-readable
     * message (which will not be passed through the translation system) and
     * translatable message (which WILL be passed through the translation
     * system), both of which should describe the policy violation that
     * occurred.
     *
     * @param message
     *     A human-readable message describing the policy violation that
     *     occurred.
     *
     * @param translatableMessage
     *     A translatable message which, after being passed through the
     *     translation system, describes the policy violation that occurred.
     */
    public PasswordPolicyException(String message, TranslatableMessage translatableMessage) {
        super(message);
        this.translatableMessage = translatableMessage;
    }

    @Override
    public TranslatableMessage getTranslatableMessage() {
        return translatableMessage;
    }

}
