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

import java.util.Collection;

/**
 * Represents an arbitrary field with a finite, enumerated set of possible
 * values.
 */
public class EnumField extends Field {

    /**
     * Creates a new EnumField with the given name and possible values.
     *
     * @param name
     *     The unique name to associate with this field.
     *
     * @param options
     *     All possible legal options for this field.
     */
    public EnumField(String name, Collection<String> options) {
        super(name, Field.Type.ENUM, options);
    }

}
