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

package org.apache.guacamole.form;

import java.util.Collections;

/**
 * Represents a field with strictly one possible value. It is assumed that the
 * field may be blank, but that its sole non-blank value is the value provided.
 * The provided value represents "true" while all other values, including
 * having no associated value, represent "false".
 */
public class BooleanField extends Field {

    /**
     * Creates a new BooleanField with the given name and truth value. The
     * truth value is the value that, when assigned to this field, means that
     * this field is "true".
     *
     * @param name
     *     The unique name to associate with this field.
     *
     * @param truthValue
     *     The value to consider "true" for this field. All other values will
     *     be considered "false".
     */
    public BooleanField(String name, String truthValue) {
        super(name, Field.Type.BOOLEAN, Collections.singletonList(truthValue));
    }

}
