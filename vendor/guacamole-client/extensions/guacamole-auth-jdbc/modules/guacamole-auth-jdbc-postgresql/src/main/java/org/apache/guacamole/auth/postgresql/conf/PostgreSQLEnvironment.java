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

package org.apache.guacamole.auth.postgresql.conf;

import java.io.File;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicy;
import org.apache.ibatis.session.SqlSession;

/**
 * A PostgreSQL-specific implementation of JDBCEnvironment provides database
 * properties specifically for PostgreSQL.
 */
public class PostgreSQLEnvironment extends JDBCEnvironment {

    /**
     * The default host to connect to, if POSTGRESQL_HOSTNAME is not specified.
     */
    private static final String DEFAULT_HOSTNAME = "localhost";

    /**
     * The default port to connect to, if POSTGRESQL_PORT is not specified.
     */
    private static final int DEFAULT_PORT = 5432;

    /**
     * The default number of seconds the driver will wait for a response from
     * the database, before aborting the query.
     * A value of 0 (the default) means the timeout is disabled.
     */
    private static final int DEFAULT_STATEMENT_TIMEOUT = 0;

    /**
     * The default number of seconds to wait for socket read operations.
     * A value of 0 (the default) means the timeout is disabled.
     */
    private static final int DEFAULT_SOCKET_TIMEOUT = 0;

    /**
     * Whether a database user account is required by default for authentication
     * to succeed.
     */
    private static final boolean DEFAULT_USER_REQUIRED = false;

    /**
     * The default value for the maximum number of connections to be
     * allowed to the Guacamole server overall.
     */
    private final int DEFAULT_ABSOLUTE_MAX_CONNECTIONS = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed per user to any one connection. Note that, as long as the
     * legacy "disallow duplicate" and "disallow simultaneous" properties are
     * still supported, these cannot be constants, as the legacy properties
     * dictate the values that should be used in the absence of the correct
     * properties.
     */
    private final int DEFAULT_MAX_CONNECTIONS_PER_USER = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed per user to any one connection group. Note that, as long as the
     * legacy "disallow duplicate" and "disallow simultaneous" properties are
     * still supported, these cannot be constants, as the legacy properties
     * dictate the values that should be used in the absence of the correct
     * properties.
     */
    private final int DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER = 1;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection. Note that, as long as the legacy
     * "disallow duplicate" and "disallow simultaneous" properties are still
     * supported, these cannot be constants, as the legacy properties dictate
     * the values that should be used in the absence of the correct properties.
     */
    private final int DEFAULT_MAX_CONNECTIONS = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection group. Note that, as long as the legacy
     * "disallow duplicate" and "disallow simultaneous" properties are still
     * supported, these cannot be constants, as the legacy properties dictate
     * the values that should be used in the absence of the correct properties.
     */
    private final int DEFAULT_MAX_GROUP_CONNECTIONS = 0;

    /**
     * The default value to use for SSL mode if none is explicitly configured.
     */
    private final PostgreSQLSSLMode DEFAULT_SSL_MODE = PostgreSQLSSLMode.PREFER;
    
    /**
     * The default maximum number of identifiers/parameters to be included in a 
     * single batch when executing SQL statements for PostgreSQL.
     * 
     * PostgreSQL has a maximum limit of 65535 parameters per prepared statement.
     * A value of 5000 is chosen to avoid potential performance issues or query
     * execution errors while staying well below the maximum limit.
     *
     * @see https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-MAX-PREPARED-STATEMENT-ARGS
     */
    private static final int DEFAULT_BATCH_SIZE = 5000;

    /**
     * Constructs a new PostgreSQLEnvironment, providing access to PostgreSQL-specific
     * configuration options.
     *
     * @throws GuacamoleException
     *     If an error occurs while setting up the underlying JDBCEnvironment
     *     or while parsing legacy PostgreSQL configuration options.
     */
    public PostgreSQLEnvironment() throws GuacamoleException {

        // Init underlying JDBC environment
        super();

    }

    @Override
    public boolean isUserRequired() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_USER_REQUIRED,
            DEFAULT_USER_REQUIRED
        );
    }

    @Override
    public int getAbsoluteMaxConnections() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_ABSOLUTE_MAX_CONNECTIONS,
            DEFAULT_ABSOLUTE_MAX_CONNECTIONS
        );
    }

    @Override
    public int getBatchSize() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_BATCH_SIZE,
            DEFAULT_BATCH_SIZE
        );
    }    
    
    @Override
    public int getDefaultMaxConnections() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_DEFAULT_MAX_CONNECTIONS,
            DEFAULT_MAX_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxGroupConnections() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_DEFAULT_MAX_GROUP_CONNECTIONS,
            DEFAULT_MAX_GROUP_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_DEFAULT_MAX_CONNECTIONS_PER_USER,
            DEFAULT_MAX_CONNECTIONS_PER_USER
        );
    }

    @Override
    public int getDefaultMaxGroupConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER,
            DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER
        );
    }

    @Override
    public PasswordPolicy getPasswordPolicy() {
        return new PostgreSQLPasswordPolicy(this);
    }

    /**
     * Returns the hostname of the PostgreSQL server hosting the Guacamole
     * authentication tables. If unspecified, this will be "localhost".
     *
     * @return
     *     The URL of the PostgreSQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public String getPostgreSQLHostname() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_HOSTNAME,
            DEFAULT_HOSTNAME
        );
    }

    /**
     * Returns the port number of the PostgreSQL server hosting the Guacamole
     * authentication tables. If unspecified, this will be the default
     * PostgreSQL port of 5432.
     *
     * @return
     *     The port number of the PostgreSQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public int getPostgreSQLPort() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_PORT,
            DEFAULT_PORT
        );
    }

    /**
     * Returns the name of the PostgreSQL database containing the Guacamole
     * authentication tables.
     *
     * @return
     *     The name of the PostgreSQL database.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value, or if the
     *     value was not set, as this property is required.
     */
    public String getPostgreSQLDatabase() throws GuacamoleException {
        return getRequiredProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_DATABASE);
    }

    @Override
    public String getUsername() throws GuacamoleException {
        return getRequiredProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_USERNAME);
    }

    @Override
    public String getPassword() throws GuacamoleException {
        return getRequiredProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_PASSWORD);
    }

    /**
     * Returns the defaultStatementTimeout set for PostgreSQL connections.
     * If unspecified, this will default to 0,
     * and should not be passed through to the backend.
     *
     * @return
     *     The statement timeout (in seconds)
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public int getPostgreSQLDefaultStatementTimeout() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_DEFAULT_STATEMENT_TIMEOUT,
            DEFAULT_STATEMENT_TIMEOUT
        );
    }

    /**
     * Returns the socketTimeout property to set on PostgreSQL connections.
     * If unspecified, this will default to 0 (no timeout)
     *
     * @return
     *     The socketTimeout to use when waiting on read operations (in seconds)
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public int getPostgreSQLSocketTimeout() throws GuacamoleException {
        return getProperty(
            PostgreSQLGuacamoleProperties.POSTGRESQL_SOCKET_TIMEOUT,
            DEFAULT_SOCKET_TIMEOUT
        );
    }

    @Override
    public boolean isRecursiveQuerySupported(SqlSession session) {
        return true; // All versions of PostgreSQL support recursive queries through CTEs
    }

    /**
     * Get the SSL mode to use to make the JDBC connection to the PostgreSQL
     * server.  If unspecified this will default to PREFER, attempting SSL
     * and falling back to plain-text if SSL fails.
     *
     * @return
     *     The enum value of the SSL mode to use to make the JDBC connection
     *     to the server.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the value from guacamole.properties.
     */
    public PostgreSQLSSLMode getPostgreSQLSSLMode() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_SSL_MODE,
                DEFAULT_SSL_MODE);
    }

    /**
     * Return the SSL client certificate file to use to make the connection
     * to the PostgreSQL server.
     *
     * @return
     *     The SSL client certificate file to use for the PostgreSQL connection.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the value from guacamole.properties.
     */
    public File getPostgreSQLSSLClientCertFile() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_SSL_CERT_FILE);
    }

    /**
     * Return the SSL client private key file to use to make the connection to the
     * PostgreSQL server.
     *
     * @return
     *     The SSL client private key file to use for the PostgreSQL connection.
     * @throws GuacamoleException
     *     If an error occurs retrieving the value from guacamole.properties.
     */
    public File getPostgreSQLSSLClientKeyFile() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_SSL_KEY_FILE);
    }

    /**
     * Return the SSL client root certificate file to use to make the connection
     * to the PostgreSQL server.
     *
     * @return
     *     The SSL client root certificate file to use to make the connection
     *     to the PostgreSQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the value from guacamole.properties.
     */
    public File getPostgreSQLSSLClientRootCertFile() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_SSL_ROOT_CERT_FILE);
    }

    /**
     * Return the password to use to decrypt the private SSL key file when making
     * the connection to the PostgreSQL server.
     *
     * @return
     *     The password to use to decrypt the private SSL key file when making
     *     the connection to the PostgreSQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the value from guacamole.properties.
     */
    public String getPostgreSQLSSLClientKeyPassword() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_SSL_KEY_PASSWORD);
    }

    @Override
    public boolean autoCreateAbsentAccounts() throws GuacamoleException {
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_AUTO_CREATE_ACCOUNTS,
                false);
    }

    @Override
    public boolean trackExternalConnectionHistory() throws GuacamoleException {

        // Track external connection history unless explicitly disabled
        return getProperty(PostgreSQLGuacamoleProperties.POSTGRESQL_TRACK_EXTERNAL_CONNECTION_HISTORY,
                true);
    }

    @Override
    public boolean enforceAccessWindowsForActiveSessions() throws GuacamoleException {

        // Enforce access window restrictions for active sessions unless explicitly disabled
        return getProperty(
                PostgreSQLGuacamoleProperties.POSTGRESQL_ENFORCE_ACCESS_WINDOWS_FOR_ACTIVE_SESSIONS,
                true);
    }

}
