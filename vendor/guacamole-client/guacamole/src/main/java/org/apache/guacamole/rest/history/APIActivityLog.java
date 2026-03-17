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

package org.apache.guacamole.rest.history;

import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.auth.ActivityLog;

/**
 * A activity log which may be exposed through the REST endpoints.
 */
public class APIActivityLog {

    /**
     * The type of this ActivityLog.
     */
    private final ActivityLog.Type type;

    /**
     * A human-readable description of this log.
     */
    private final TranslatableMessage description;

    /**
     * Creates a new APIActivityLog, copying the data from the given activity
     * log.
     *
     * @param log
     *     The log to copy data from.
     */
    public APIActivityLog(ActivityLog log) {
        this.type = log.getType();
        this.description = log.getDescription();
    }

    /**
     * Returns the type of this activity log. The type of an activity log
     * dictates how its content should be interpreted or exposed, however the
     * content of a log is not directly exposed by this class.
     *
     * @return
     *     The type of this activity log.
     */
    public ActivityLog.Type getType() {
        return type;
    }

    /**
     * Returns a human-readable message that describes this log.
     *
     * @return
     *     A human-readable message that describes this log.
     */
    public TranslatableMessage getDescription() {
        return description;
    }

}
