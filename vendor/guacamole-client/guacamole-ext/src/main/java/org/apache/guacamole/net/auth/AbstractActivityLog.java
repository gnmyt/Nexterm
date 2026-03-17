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

package org.apache.guacamole.net.auth;

import org.apache.guacamole.language.TranslatableMessage;

/**
 * Base implementation of an ActivityLog, providing storage and simple
 * getters/setters for its main properties.
 */
public abstract class AbstractActivityLog implements ActivityLog {

    /**
     * The type of this ActivityLog.
     */
    private final Type type;

    /**
     * A human-readable description of this log.
     */
    private final TranslatableMessage description;

    /**
     * Creates a new AbstractActivityLog having the given type and
     * human-readable description.
     *
     * @param type
     *     The type of this ActivityLog.
     *
     * @param description
     *     A human-readable message that describes this log.
     */
    public AbstractActivityLog(Type type, TranslatableMessage description) {
        this.type = type;
        this.description = description;
    }

    @Override
    public Type getType() {
        return type;
    }

    @Override
    public TranslatableMessage getDescription() {
        return description;
    }

}
