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

package org.apache.guacamole.auth.mysql.conf;

import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.apache.guacamole.properties.FileGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;
import org.apache.guacamole.properties.TimeZoneGuacamoleProperty;

/**
 * Properties used by the MySQL Authentication plugin.
 */
public class MySQLGuacamoleProperties {

    /**
     * This class should not be instantiated.
     */
    private MySQLGuacamoleProperties() {}

    /**
     * The JDBC driver that should be used to talk to MySQL-compatible servers.
     */
    public static final EnumGuacamoleProperty<MySQLDriver> MYSQL_DRIVER =
            new EnumGuacamoleProperty<MySQLDriver>(MySQLDriver.class) {

        @Override
        public String getName() { return "mysql-driver"; }

    };

    /**
     * The hostname of the MySQL server hosting the Guacamole authentication
     * tables.
     */
    public static final StringGuacamoleProperty MYSQL_HOSTNAME = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-hostname"; }

    };

    /**
     * The port number of the MySQL server hosting the Guacamole authentication
     * tables.
     */
    public static final IntegerGuacamoleProperty MYSQL_PORT = new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-port"; }

    };

    /**
     * The name of the MySQL database containing the Guacamole authentication
     * tables.
     */
    public static final StringGuacamoleProperty MYSQL_DATABASE = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-database"; }

    };

    /**
     * The username that should be used when authenticating with the MySQL
     * database containing the Guacamole authentication tables.
     */
    public static final StringGuacamoleProperty MYSQL_USERNAME = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-username"; }

    };

    /**
     * The password that should be used when authenticating with the MySQL
     * database containing the Guacamole authentication tables.
     */
    public static final StringGuacamoleProperty MYSQL_PASSWORD = new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-password"; }

    };

    /**
     * Whether a user account within the database is required for authentication
     * to succeed, even if the user has been authenticated via another
     * authentication provider.
     */
    public static final BooleanGuacamoleProperty MYSQL_USER_REQUIRED = new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-user-required"; }

    };

    /**
     * The maximum number of concurrent connections to allow overall. Zero
     * denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            MYSQL_ABSOLUTE_MAX_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-absolute-max-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            MYSQL_DEFAULT_MAX_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-default-max-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection group. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            MYSQL_DEFAULT_MAX_GROUP_CONNECTIONS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-default-max-group-connections"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection by an individual user. Zero denotes unlimited.
     */
    public static final IntegerGuacamoleProperty
            MYSQL_DEFAULT_MAX_CONNECTIONS_PER_USER =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-default-max-connections-per-user"; }

    };

    /**
     * The maximum number of concurrent connections to allow to any one
     * connection group by an individual user. Zero denotes
     * unlimited.
     */
    public static final IntegerGuacamoleProperty
            MYSQL_DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-default-max-group-connections-per-user"; }

    };

    /**
     * The SSL mode used to connect to the MySQL Server.  By default the driver
     * will attempt SSL connections and fall back to plain-text if SSL fails.
     */
    public static final EnumGuacamoleProperty<MySQLSSLMode> MYSQL_SSL_MODE =
            new EnumGuacamoleProperty<MySQLSSLMode>(MySQLSSLMode.class) {

        @Override
        public String getName() { return "mysql-ssl-mode" ; }

    };

    /**
     * The File where trusted SSL certificate authorities and server certificates
     * are stored.  By default no file is specified, and the default Java
     * trusted certificate stores will be used.
     */
    public static final FileGuacamoleProperty MYSQL_SSL_TRUST_STORE =
            new FileGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-ssl-trust-store"; }

    };

    /**
     * The password to use to access the mysql-ssl-trust-store, if required.  By
     * default no password will be used to attempt to access the store.
     */
    public static final StringGuacamoleProperty MYSQL_SSL_TRUST_PASSWORD =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-ssl-trust-password"; }

    };

    /**
     * The File used to store the client certificate for configurations where
     * a client certificate is required for authentication.  By default no
     * client certificate store will be specified.
     */
    public static final FileGuacamoleProperty MYSQL_SSL_CLIENT_STORE =
            new FileGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-ssl-client-store"; }

    };

    /**
     * The password to use to access the mysql-ssl-client-store file.  By
     * default no password will be used to attempt to access the file.
     */
    public static final StringGuacamoleProperty MYSQL_SSL_CLIENT_PASSWORD =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-ssl-client-password"; }

    };

    /**
     * Whether or not to automatically create accounts in the MySQL database for
     * users who successfully authenticate through another extension. By default
     * users will not be automatically created.
     */
    public static final BooleanGuacamoleProperty MYSQL_AUTO_CREATE_ACCOUNTS =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-auto-create-accounts"; }
    };

    /**
     * The time zone of the MySQL database server.
     */
    public static final TimeZoneGuacamoleProperty SERVER_TIMEZONE =
            new TimeZoneGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-server-timezone"; }

    };

    /**
     * Whether or not to track connection history for connections that do not originate
     * from within the MySQL database. By default, external connection history will be
     * tracked.
     */
    public static final BooleanGuacamoleProperty MYSQL_TRACK_EXTERNAL_CONNECTION_HISTORY =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-track-external-connection-history"; }

    };

    /**
     * Whether or not user-specific access time windows should be enforced for active sessions,
     * i.e. whether users with active sessions should be logged out immediately when an access
     * window closes.
     */
    public static final BooleanGuacamoleProperty MYSQL_ENFORCE_ACCESS_WINDOWS_FOR_ACTIVE_SESSIONS =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-enforce-access-windows-for-active-sessions"; }

    };

    /**
     * The maximum number of identifiers/parameters to be included in a single batch when
     * executing SQL statements.
     */
    public static final IntegerGuacamoleProperty MYSQL_BATCH_SIZE =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "mysql-batch-size"; }

    };
    
}
