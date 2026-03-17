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

/**
 * An object which has a deterministic, unique identifier, which may not be
 * null.
 */
public interface Identifiable {

    /**
     * Returns the unique identifier assigned to this object. All identifiable
     * objects must have a deterministic, unique identifier which may not be
     * null.
     *
     * @return
     *     The unique identifier assigned to this object, which may not be
     *     null.
     */
    public String getIdentifier();

    /**
     * Sets the identifier assigned to this object.
     *
     * @param identifier
     *     The identifier to assign.
     */
    public void setIdentifier(String identifier);

}
