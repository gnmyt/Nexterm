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

/**
 * A message which can be translated using a translation service, providing a
 * translation key and optional set of values to be substituted into the
 * translation string associated with that key.
 */
public class TranslatableMessage {

    /**
     * The arbitrary key which can be used to look up the message to be
     * displayed in the user's native language.
     */
    private final String key;

    /**
     * An arbitrary object whose properties should be substituted for the
     * corresponding placeholders within the string associated with the key.
     */
    private final Object variables;

    /**
     * Creates a new TranslatableMessage associated with the given translation
     * key, without any associated variables.
     *
     * @param key
     *     The translation key to associate with the TranslatableMessage.
     */
    public TranslatableMessage(String key) {
        this(key, null);
    }

    /**
     * Creates a new TranslatableMessage associated with the given translation
     * key and associated variables.
     *
     * @param key
     *     The translation key to associate with the TranslatableMessage.
     *
     * @param variables
     *     An arbitrary object whose properties should be substituted for the
     *     corresponding placeholders within the string associated with the
     *     given translation key.
     */
    public TranslatableMessage(String key, Object variables) {
        this.key = key;
        this.variables = variables;
    }

    /**
     * Returns the arbitrary key which can be used to look up the message to be
     * displayed in the user's native language.
     *
     * @return
     *     The arbitrary key associated with the human-readable message.
     */
    public String getKey() {
        return key;
    }

    /**
     * Returns an arbitrary object whose properties should be substituted for
     * the corresponding placeholders within the string associated with the key.
     * If not applicable, null is returned.
     *
     * @return
     *     An arbitrary object whose properties should be substituted for the
     *     corresponding placeholders within the string associated with the key,
     *     or null if not applicable.
     */
    public Object getVariables() {
        return variables;
    }

}
