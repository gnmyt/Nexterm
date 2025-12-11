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

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.credentials.UserCredentials;

/**
 * An object which can be shared with others via specially-generated sets of
 * credentials. It is expected, but not required, that these credentials are
 * temporary.
 *
 * @param <T>
 *     The type of object which dictates the semantics/restrictions of shared
 *     objects.
 */
public interface Shareable<T> {

    /**
     * Returns a full set of credentials which can be used to authenticate as a
     * user with access strictly to this object. The semantics and restrictions
     * of the shared object (when accessed using the returned sharing
     * credentials) are defined by the {@link T} associated with the given
     * identifier and within the
     * {@link Directory}&lt;{@link T}&gt; of the same {@link UserContext} that
     * this Shareable was retrieved from.
     *
     * @param identifier
     *     The identifier of a {@link T} within the
     *     {@link Directory}&lt;{@link T}&gt; of the same {@link UserContext}
     *     that this Shareable was retrieved from.
     *
     * @return
     *     A full set of credentials which can be used to authenticate and
     *     obtain access to this object.
     *
     * @throws GuacamoleException
     *     If credentials could not be generated, or permission to share this
     *     object is denied.
     */
    public UserCredentials getSharingCredentials(String identifier)
            throws GuacamoleException;

}
