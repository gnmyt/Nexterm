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

package org.apache.guacamole.auth.restrict.form;

import org.apache.guacamole.form.Field;

/**
 * A field that parses a string containing time restrictions into its individual
 * components for user-friendly display on the web interface.
 */
public class TimeRestrictionField extends Field {
    
    /**
     * The field type.
     */
    public static final String FIELD_TYPE = "GUAC_TIME_RESTRICTION";
    
    /**
     * Create a new field that tracks time restrictions.
     * 
     * @param name
     *     The name of the parameter that will be used to pass this field
     *     between the REST API and the web front-end.
     * 
     */
    public TimeRestrictionField(String name) {
        super(name, FIELD_TYPE);
    }
    
}
