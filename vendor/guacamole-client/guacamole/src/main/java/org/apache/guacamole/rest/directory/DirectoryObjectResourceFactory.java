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

package org.apache.guacamole.rest.directory;

import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.UserContext;

/**
 * Factory which creates DirectoryObjectResource instances exposing objects of
 * a particular type.
 *
 * @param <InternalType>
 *     The type of object exposed by the DirectoryObjectResource instances
 *     created by this DirectoryResourceFactory.
 *
 * @param <ExternalType>
 *     The type of object used in interchange (ie: serialized or deserialized
 *     as JSON) between REST clients and resources when representing the
 *     InternalType.
 */
public interface DirectoryObjectResourceFactory<InternalType extends Identifiable, ExternalType> {

    /**
     * Creates a new DirectoryObjectResource which exposes the given object.
     *
     * @param authenticatedUser
     *     The user that is accessing the resource.
     *
     * @param userContext
     *     The UserContext which contains the given Directory.
     *
     * @param directory
     *     The Directory which contains the object being exposed.
     *
     * @param object
     *     The object which should be exposed by the created
     *     DirectoryObjectResource.
     *
     * @return
     *     A new DirectoryObjectResource which exposes the given object.
     */
    DirectoryObjectResource<InternalType, ExternalType>
        create(AuthenticatedUser authenticatedUser, UserContext userContext,
                Directory<InternalType> directory, InternalType object);

}
