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

package org.apache.guacamole.auth.sqlserver.conf;

import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;

/**
 * Properties used by the SQLServer Authentication plugin.
 */
public class SQLServerGuacamoleProperties {

    /**
     * This class should not be instantiated.
     */
    private SQLServerGuacamoleProperties() {}

    /**
     * The URL of the SQLServer server hosting the Guacamole authentication tables.
     */
    public static final StringGuacamoleProperty SQLSERVER_HOSTNAME =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-hostname"; }

    };

    /**
     * The instance name of the SQL Server where the Guacamole database is running.
     */
    public static final StringGuacamoleProperty SQLSERVER_INSTANCE =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-instance"; }

    };

    /**
     * The port of the SQLServer server hosting the Guacamole authentication
     * tables.
     */
    public static final IntegerGuacamoleProperty SQLSERVER_PORT =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-port"; }

    };

    /**
     * The name of the SQLServer database containing the Guacamole
     * authentication tables.
     */
    public static final StringGuacamoleProperty SQLSERVER_DATABASE =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-database"; }

    };

    /**
     * The username used to authenticate to the SQLServer database containing
     * the Guacamole authentication tables.
     */
    public static final StringGuacamoleProperty SQLSERVER_USERNAME =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-username"; }

    };

    /**
     * The password used to authenticate to the SQLServer database containing
     * the Guacamole authentication tables.
     */
    public static final StringGuacamoleProperty SQLSERVER_PASSWORD =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-password"; }

    };

    /**
     * Whether a user account within the database is required for authentication
     * to succeed, even if the user has been authenticated via another
     * authentication provider.
     */
    public static final BooleanGuacamoleProperty
            SQLSERVER_USER_REQUIRED = new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-user-required"; }

    };

    /**
     * The maximum number of concurrent connections to allow overall. Zero
     * denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            SQLSERVER_ABSOLUTE_MAX_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-absolute-max-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            SQLSERVER_DEFAULT_MAX_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-default-max-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection group. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            SQLSERVER_DEFAULT_MAX_GROUP_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-default-max-group-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection by an individual user. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            SQLSERVER_DEFAULT_MAX_CONNECTIONS_PER_USER =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-default-max-connections-per-user"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection group by an individual user. Zero denotes
     * unlimited.
     */
    public static final IntegerGuacamoleProperty
            SQLSERVER_DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-default-max-group-connections-per-user"; }

    };

    /**
     * Which TDS-compatible JDBC driver should be used for the connection.
     */
    public static final EnumGuacamoleProperty<SQLServerDriver>
            SQLSERVER_DRIVER = new EnumGuacamoleProperty<SQLServerDriver>(SQLServerDriver.class) {

        @Override
        public String getName() { return "sqlserver-driver"; }

    };

    /**
     * Whether or not to automatically create accounts in the SQL Server
     * database for users who successfully authenticate through another
     * extension. By default users will not be automatically created.
     */
    public static final BooleanGuacamoleProperty SQLSERVER_AUTO_CREATE_ACCOUNTS =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-auto-create-accounts"; }

    };

    /**
     * Whether or not to track connection history for connections that do not originate
     * from within the SQL Server database. By default, external connection history will be
     * tracked.
     */
    public static final BooleanGuacamoleProperty SQLSERVER_TRACK_EXTERNAL_CONNECTION_HISTORY =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-track-external-connection-history"; }

    };

    /**
     * Whether or not user-specific access time windows should be enforced for active sessions,
     * i.e. whether users with active sessions should be logged out immediately when an access
     * window closes.
     */
    public static final BooleanGuacamoleProperty SQLSERVER_ENFORCE_ACCESS_WINDOWS_FOR_ACTIVE_SESSIONS =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-enforce-access-windows-for-active-sessions"; }

    };
    
    /**
     * The maximum number of identifiers/parameters to be included in a single batch when
     * executing SQL statements.
     */
    public static final IntegerGuacamoleProperty SQLSERVER_BATCH_SIZE =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-batch-size"; }

    };

    /**
     * Whether or not all server certificates should be trusted, including those
     * signed by an unknown certificate authority, such as self-signed
     * certificates.
     */
    public static final BooleanGuacamoleProperty SQLSERVER_TRUST_ALL_SERVER_CERTIFICATES =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "sqlserver-trust-all-server-certificates"; }

    };

}
