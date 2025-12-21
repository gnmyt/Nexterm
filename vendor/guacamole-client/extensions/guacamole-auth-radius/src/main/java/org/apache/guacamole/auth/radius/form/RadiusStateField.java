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

package org.apache.guacamole.auth.radius.form;

import org.apache.guacamole.form.Field;

/**
 * The invisible field that stores the state of the RADIUS
 * connection.  The state is simply a placeholder that helps
 * the client and server pick back up the conversation
 * at the correct spot during challenge/response.
 */
public class RadiusStateField extends Field {
    
    /**
     * The parameter returned by the RADIUS state.
     */
    public static final String PARAMETER_NAME = "guac-radius-state";

    /**
     * The type of field to initialize for the state.
     */
    private static final String RADIUS_FIELD_TYPE = "GUAC_RADIUS_STATE";

    /**
     * The state of the connection passed by the previous RADIUS attempt.
     */
    private final String radiusState;

    /**
     * Initialize the field with the state returned by the RADIUS server.
     *
     * @param radiusState
     *     The state returned by the RADIUS server.
     */
    public RadiusStateField(String radiusState) {
        super(PARAMETER_NAME, RADIUS_FIELD_TYPE);
        this.radiusState = radiusState;

    }

    /**
     * Get the state provided by the RADIUS server.
     *
     * @return
     *     The state provided by the RADIUS server.
     */
    public String getRadiusState() {
        return radiusState;
    }

}
