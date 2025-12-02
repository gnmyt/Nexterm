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

package org.apache.guacamole.auth.postgresql;

import com.google.inject.Guice;
import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCAuthenticationProviderModule;
import org.apache.guacamole.auth.jdbc.JDBCInjectorProvider;
import org.apache.guacamole.auth.postgresql.conf.PostgreSQLEnvironment;

/**
 * JDBCInjectorProvider implementation which configures Guice injections for
 * connecting to a PostgreSQL database based on PostgreSQL-specific options
 * provided via guacamole.properties.
 */
public class PostgreSQLInjectorProvider extends JDBCInjectorProvider {

    @Override
    protected Injector create() throws GuacamoleException {

        // Get local environment
        PostgreSQLEnvironment environment = new PostgreSQLEnvironment();

        // Set up Guice injector
        return Guice.createInjector(
            new JDBCAuthenticationProviderModule(environment),
            new PostgreSQLAuthenticationProviderModule(environment)
        );

    }

}
