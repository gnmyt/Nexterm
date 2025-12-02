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

import java.util.function.Function;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.net.auth.ActivityLog;
import org.apache.guacamole.net.auth.ActivityRecord;

/**
 * A REST resource which exposes a single ActivityRecord, allowing any
 * associated and accessible logs to be retrieved.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ActivityRecordResource {

    /**
     * The ActivityRecord being exposed.
     */
    private final ActivityRecord record;

    /**
     * The REST API object representing the ActivityRecord being exposed.
     */
    private final APIActivityRecord externalRecord;

    /**
     * Creates a new ActivityRecordResource which exposes the given record.
     *
     * @param record
     *     The ActivityRecord that should be exposed.
     *
     * @param externalRecord
     *     The REST API object representing the ActivityRecord being exposed.
     */
    public ActivityRecordResource(ActivityRecord record,
            APIActivityRecord externalRecord) {
        this.record = record;
        this.externalRecord = externalRecord;
    }

    /**
     * Returns the record represented by this ActivityRecordResource, in a
     * format intended for interchange.
     *
     * @return
     *     The record that this ActivityRecordResource represents, in a format
     *     intended for interchange.
     */
    @GET
    public APIActivityRecord getRecord() {
        return externalRecord;
    }

    /**
     * Returns an ActivityLogResource representing the log associated with the
     * underlying ActivityRecord and having the given name. If no such log
     * can be retrieved, either because it does not exist or the current user
     * does not have access, an exception is thrown.
     *
     * @param logName
     *     The unique name of the log to retrieve.
     *
     * @return
     *     An ActivityLogResource representing the log having the given name.
     *
     * @throws GuacamoleException
     *     If no such log can be retrieved.
     */
    @Path("logs/{name}")
    public ActivityLogResource getLog(@PathParam("name") String logName)
            throws GuacamoleException {

        ActivityLog log = record.getLogs().get(logName);
        if (log != null)
            return new ActivityLogResource(log);

        throw new GuacamoleResourceNotFoundException("No such log.");

    }

}
