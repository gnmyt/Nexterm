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

package org.apache.guacamole.auth.sqlserver;

import com.google.inject.Guice;
import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCAuthenticationProviderModule;
import org.apache.guacamole.auth.jdbc.JDBCInjectorProvider;
import org.apache.guacamole.auth.sqlserver.conf.SQLServerEnvironment;

/**
 * JDBCInjectorProvider implementation which configures Guice injections for
 * connecting to a SQLServer database based on SQLServer-specific options
 * provided via guacamole.properties.
 */
public class SQLServerInjectorProvider extends JDBCInjectorProvider {

    @Override
    protected Injector create() throws GuacamoleException {

        // Get local environment
        SQLServerEnvironment environment = new SQLServerEnvironment();

        // Set up Guice injector
        return Guice.createInjector(
            new JDBCAuthenticationProviderModule(environment),
            new SQLServerAuthenticationProviderModule(environment)
        );

    }

}
