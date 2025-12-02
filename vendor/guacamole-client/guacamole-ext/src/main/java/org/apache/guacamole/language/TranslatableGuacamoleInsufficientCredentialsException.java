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

package org.apache.guacamole.language;

import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;

/**
 * A {@link GuacamoleInsufficientCredentialsException} whose associated message
 * is translatable and can be passed through an arbitrary translation service,
 * producing a human-readable message in the user's native language.
 */
public class TranslatableGuacamoleInsufficientCredentialsException
        extends GuacamoleInsufficientCredentialsException implements Translatable {

    /**
     * A translatable, human-readable description of the exception that
     * occurred.
     */
    private final TranslatableMessage translatableMessage;

    /**
     * Creates a new TranslatableGuacamoleInsufficientCredentialsException with
     * the given message, cause, and associated credential information. The
     * message must be provided in both non-translatable (readable as-written)
     * and translatable forms.
     *
     * @param message
     *     A human-readable description of the exception that occurred. This
     *     message should be readable on its own and as-written, without
     *     requiring a translation service.
     *
     * @param translatableMessage
     *     A translatable, human-readable description of the exception that
     *     occurred.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public TranslatableGuacamoleInsufficientCredentialsException(String message,
            TranslatableMessage translatableMessage, Throwable cause, CredentialsInfo credentialsInfo) {
        super(message, cause, credentialsInfo);
        this.translatableMessage = translatableMessage;
    }

    /**
     * Creates a new TranslatableGuacamoleInsufficientCredentialsException with
     * the given message, and associated credential information. The message
     * must be provided in both non-translatable (readable as-written) and
     * translatable forms.
     *
     * @param message
     *     A human-readable description of the exception that occurred. This
     *     message should be readable on its own and as-written, without
     *     requiring a translation service.
     *
     * @param translatableMessage
     *     A translatable, human-readable description of the exception that
     *     occurred.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public TranslatableGuacamoleInsufficientCredentialsException(String message,
            TranslatableMessage translatableMessage, CredentialsInfo credentialsInfo) {
        super(message, credentialsInfo);
        this.translatableMessage = translatableMessage;
    }

    /**
     * Creates a new TranslatableGuacamoleInsufficientCredentialsException with
     * the given message, cause, and associated credential information. The
     * message must be provided in both non-translatable (readable as-written)
     * and translatable forms.
     *
     * @param message
     *     A human-readable description of the exception that occurred. This
     *     message should be readable on its own and as-written, without
     *     requiring a translation service.
     *
     * @param key
     *     The arbitrary key which can be used to look up the message to be
     *     displayed in the user's native language.
     *
     * @param cause
     *     The cause of this exception.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public TranslatableGuacamoleInsufficientCredentialsException(String message,
            String key, Throwable cause, CredentialsInfo credentialsInfo) {
        this(message, new TranslatableMessage(key), cause, credentialsInfo);
    }

    /**
     * Creates a new TranslatableGuacamoleInsufficientCredentialsException with
     * the given message, and associated credential information. The message
     * must be provided in both non-translatable (readable as-written) and
     * translatable forms.
     *
     * @param message
     *     A human-readable description of the exception that occurred. This
     *     message should be readable on its own and as-written, without
     *     requiring a translation service.
     *
     * @param key
     *     The arbitrary key which can be used to look up the message to be
     *     displayed in the user's native language.
     *
     * @param credentialsInfo
     *     Information describing the form of valid credentials.
     */
    public TranslatableGuacamoleInsufficientCredentialsException(String message,
            String key, CredentialsInfo credentialsInfo) {
        this(message, new TranslatableMessage(key), credentialsInfo);
    }

    @Override
    public TranslatableMessage getTranslatableMessage() {
        return translatableMessage;
    }

}
