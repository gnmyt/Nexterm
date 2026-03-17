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

package org.apache.guacamole.rest.usergroup;

import com.google.inject.AbstractModule;
import org.apache.guacamole.rest.directory.DirectoryObjectResourceFactory;
import org.apache.guacamole.rest.directory.DirectoryResourceFactory;
import com.google.inject.TypeLiteral;
import com.google.inject.assistedinject.FactoryModuleBuilder;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;
import org.apache.guacamole.rest.directory.DirectoryResource;

/**
 * Guice Module which configures injections required for handling UserGroup
 * resources via the REST API.
 */
public class UserGroupModule extends AbstractModule {

    @Override
    protected void configure() {

        // Create the required DirectoryResourceFactory implementation
        install(new FactoryModuleBuilder()
                .implement(
                    new TypeLiteral<DirectoryResource<UserGroup, APIUserGroup>>() {},
                    UserGroupDirectoryResource.class
                )
                .build(new TypeLiteral<DirectoryResourceFactory<UserGroup, APIUserGroup>>() {}));

        // Create the required DirectoryObjectResourceFactory implementation
        install(new FactoryModuleBuilder()
                .implement(
                    new TypeLiteral<DirectoryObjectResource<UserGroup, APIUserGroup>>() {},
                    UserGroupResource.class
                )
                .build(new TypeLiteral<DirectoryObjectResourceFactory<UserGroup, APIUserGroup>>() {}));

        // Bind translator for converting between UserGroup and APIUserGroup
        bind(new TypeLiteral<DirectoryObjectTranslator<UserGroup, APIUserGroup>>() {})
                .to(UserGroupObjectTranslator.class);

    }

}
