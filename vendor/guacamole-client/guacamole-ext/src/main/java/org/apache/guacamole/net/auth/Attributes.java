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

import java.util.Map;

/**
 * An object which is associated with a set of arbitrary attributes that may
 * be modifiable, defined as name/value pairs.
 */
public interface Attributes extends ReadableAttributes {

    /**
     * Sets the given attributes. If an attribute within the map is not
     * supported, it will simply be dropped. Any attributes not within the given
     * map will be left untouched. Attributes which are not declared within the
     * associated UserContext MUST NOT be submitted, but other extensions may
     * manipulate the declared attributes through decorate() and redecorate().
     *
     * Implementations may optionally allow storage of unsupported attributes.
     * Extensions which rely on other extensions to store their attribute
     * values should verify that such storage is supported by first testing
     * that the attribute value is retrievable via getAttributes() after being
     * set.
     *
     * @param attributes
     *     A map of all attribute identifiers to their corresponding values.
     */
    void setAttributes(Map<String, String> attributes);

}
