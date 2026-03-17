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

package org.apache.guacamole.auth.restrict;

import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * An exception that represents an invalid login or connection due to
 * restrictions based on the host from which the action should be allowed.
 */
public class TranslatableInvalidHostLoginException 
        extends TranslatableGuacamoleClientException {

    /**
     * The serial version ID of this class.
     */
    private static final long serialVersionUID = 1L;
    
    /**
     * Create a new host-based login exception with the given message and
     * translation string that can be processed by Guacamole's translation
     * service.
     * 
     * @param message
     *     The non-translatable, human-readable message containing details
     *     of the exception.
     * 
     * @param translatableMessage 
     *     A translatable, human-readable description of the exception that
     *     occurred.
     */
    public TranslatableInvalidHostLoginException(String message,
            TranslatableMessage translatableMessage) {
        super(message, translatableMessage);
    }
    
    /**
     * Create a new host-based login exception with the given message and
     * translation string that can be processed by Guacamole's translation
     * service.
     * 
     * @param message
     *     The non-translatable, human-readable message containing details
     *     of the exception.
     * 
     * @param translationKey
     *     The arbitrary key which can be used to look up the message to be
     *     displayed in the user's native language.
     */
    public TranslatableInvalidHostLoginException(String message, String translationKey) {
        super(message, new TranslatableMessage(translationKey));
    }
    
}
