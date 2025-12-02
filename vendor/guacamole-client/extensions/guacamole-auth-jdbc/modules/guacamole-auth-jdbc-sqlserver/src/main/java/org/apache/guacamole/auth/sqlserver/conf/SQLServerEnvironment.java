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

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicy;
import org.apache.ibatis.session.SqlSession;

/**
 * A SQLServer-specific implementation of JDBCEnvironment provides database
 * properties specifically for SQLServer.
 */
public class SQLServerEnvironment extends JDBCEnvironment {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(SQLServerEnvironment.class);

    /**
     * The default host to connect to, if SQLSERVER_HOSTNAME is not specified.
     */
    private static final String DEFAULT_HOSTNAME = "localhost";

    /**
     * The default port to connect to, if SQLSERVER_PORT is not specified.
     */
    private static final int DEFAULT_PORT = 1433;

    /**
     * Whether a database user account is required by default for authentication
     * to succeed.
     */
    private static final boolean DEFAULT_USER_REQUIRED = false;

    /**
     * The default value for the maximum number of connections to be
     * allowed to the Guacamole server overall.
     */
    private static final int DEFAULT_ABSOLUTE_MAX_CONNECTIONS = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed per user to any one connection.
     */
    private static final int DEFAULT_MAX_CONNECTIONS_PER_USER = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed per user to any one connection group.
     */
    private static final int DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER = 1;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection.
     */
    private static final int DEFAULT_MAX_CONNECTIONS = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection group.
     */
    private static final int DEFAULT_MAX_GROUP_CONNECTIONS = 0;

    /**
     * The default SQLServer driver to use.
     */
    public static final SQLServerDriver SQLSERVER_DEFAULT_DRIVER = SQLServerDriver.MICROSOFT_2005;

    /**
     * The default maximum number of identifiers/parameters to be included in a
     * single batch when executing SQL statements for SQL Server.
     *
     * SQL Server supports a maximum of 2100 parameters per query. A value of
     * 500 is chosen to stay within this limit and avoid query execution errors,
     * as some queries involve multiple parameters per item - namely retrieval
     * of connections.
     *
     * @see https://docs.microsoft.com/en-us/sql/sql-server/maximum-capacity-specifications-for-sql-server
     */
    private static final int DEFAULT_BATCH_SIZE = 500;
    
    /**
     * Constructs a new SQLServerEnvironment, providing access to SQLServer-specific
     * configuration options.
     *
     * @throws GuacamoleException
     *     If an error occurs while setting up the underlying JDBCEnvironment
     *     or while parsing legacy SQLServer configuration options.
     */
    public SQLServerEnvironment() throws GuacamoleException {

        // Init underlying JDBC environment
        super();

    }

    @Override
    public boolean isUserRequired() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_USER_REQUIRED,
            DEFAULT_USER_REQUIRED
        );
    }

    @Override
    public int getAbsoluteMaxConnections() throws GuacamoleException {
        return getProperty(SQLServerGuacamoleProperties.SQLSERVER_ABSOLUTE_MAX_CONNECTIONS,
            DEFAULT_ABSOLUTE_MAX_CONNECTIONS
        );
    }
    
    @Override
    public int getBatchSize() throws GuacamoleException {
        return getProperty(SQLServerGuacamoleProperties.SQLSERVER_BATCH_SIZE,
            DEFAULT_BATCH_SIZE
        );
    }    

    @Override
    public int getDefaultMaxConnections() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_DEFAULT_MAX_CONNECTIONS,
            DEFAULT_MAX_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxGroupConnections() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_DEFAULT_MAX_GROUP_CONNECTIONS,
            DEFAULT_MAX_GROUP_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_DEFAULT_MAX_CONNECTIONS_PER_USER,
            DEFAULT_MAX_CONNECTIONS_PER_USER
        );
    }

    @Override
    public int getDefaultMaxGroupConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER,
            DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER
        );
    }

    @Override
    public PasswordPolicy getPasswordPolicy() {
        return new SQLServerPasswordPolicy(this);
    }

    /**
     * Returns the hostname of the SQLServer server hosting the Guacamole
     * authentication tables. If unspecified, this will be "localhost".
     *
     * @return
     *     The URL of the SQLServer server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public String getSQLServerHostname() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_HOSTNAME,
            DEFAULT_HOSTNAME
        );
    }

    /**
     * Returns the instance name of the SQL Server installation hosting the
     * Guacamole database, if any.  If unspecified it will be null.
     *
     * @return
     *     The instance name of the SQL Server install hosting the Guacamole
     *     database, or null if undefined.
     *
     * @throws GuacamoleException
     *     If an error occurs reading guacamole.properties.
     */
    public String getSQLServerInstance() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_INSTANCE
        );
    }

    /**
     * Returns the port number of the SQLServer server hosting the Guacamole
     * authentication tables. If unspecified, this will be the default
     * SQLServer port of 5432.
     *
     * @return
     *     The port number of the SQLServer server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public int getSQLServerPort() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_PORT,
            DEFAULT_PORT
        );
    }

    /**
     * Returns the name of the SQLServer database containing the Guacamole
     * authentication tables.
     *
     * @return
     *     The name of the SQLServer database.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value, or if the
     *     value was not set, as this property is required.
     */
    public String getSQLServerDatabase() throws GuacamoleException {
        return getRequiredProperty(SQLServerGuacamoleProperties.SQLSERVER_DATABASE);
    }

    @Override
    public String getUsername() throws GuacamoleException {
        return getRequiredProperty(SQLServerGuacamoleProperties.SQLSERVER_USERNAME);
    }

    @Override
    public String getPassword() throws GuacamoleException {
        return getRequiredProperty(SQLServerGuacamoleProperties.SQLSERVER_PASSWORD);
    }

    /**
     * Returns which JDBC driver should be used to make the SQLServer/TDS connection.
     *
     * @return
     *     Which TDS-compatible JDBC driver should be used.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value, or if the
     *     value was not set, as this property is required.
     */
    public SQLServerDriver getSQLServerDriver() throws GuacamoleException {
        return getProperty(
            SQLServerGuacamoleProperties.SQLSERVER_DRIVER,
            SQLSERVER_DEFAULT_DRIVER
        );
    }

    @Override
    public boolean isRecursiveQuerySupported(SqlSession session) {
        return true; // All versions of SQL Server support recursive queries through CTEs
    }

    @Override
    public boolean autoCreateAbsentAccounts() throws GuacamoleException {
        return getProperty(SQLServerGuacamoleProperties.SQLSERVER_AUTO_CREATE_ACCOUNTS,
                false);
    }

    @Override
    public boolean trackExternalConnectionHistory() throws GuacamoleException {

        // Track external connection history unless explicitly disabled
        return getProperty(SQLServerGuacamoleProperties.SQLSERVER_TRACK_EXTERNAL_CONNECTION_HISTORY,
                true);
    }

    @Override
    public boolean enforceAccessWindowsForActiveSessions() throws GuacamoleException {

        // Enforce access window restrictions for active sessions unless explicitly disabled
        return getProperty(
                SQLServerGuacamoleProperties.SQLSERVER_ENFORCE_ACCESS_WINDOWS_FOR_ACTIVE_SESSIONS,
                true);
    }

    @Override
    public boolean shouldUseBatchExecutor() {

        // The SQL Server driver does not work when batch execution is enabled.
        // Specifically, inserts fail with com.microsoft.sqlserver.jdbc.SQLServerException:
        // The statement must be executed before any results can be obtained.
        // See https://github.com/microsoft/mssql-jdbc/issues/358 for more.
        logger.warn(
                "JDBC batch executor is disabled for SQL Server Connections. "
                + "Large batched updates may run slower."
        );
        return false;
        
    }

    /**
     * Returns true if all server certificates should be trusted, including
     * those signed by an unknown certificate authority, such as self-signed
     * certificates, or false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value, or if the
     *     value was not set, as this property is required.
     */
    public boolean trustAllServerCertificates() throws GuacamoleException {

        // Do not trust unknown certificates unless explicitly enabled
        return getProperty(
                SQLServerGuacamoleProperties.SQLSERVER_TRUST_ALL_SERVER_CERTIFICATES,
                false);
    }

}
