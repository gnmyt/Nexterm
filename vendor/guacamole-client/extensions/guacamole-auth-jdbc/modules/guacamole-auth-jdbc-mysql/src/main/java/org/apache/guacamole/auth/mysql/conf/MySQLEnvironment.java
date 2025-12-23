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

import java.io.File;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.TimeZone;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicy;
import org.apache.ibatis.exceptions.PersistenceException;
import org.apache.ibatis.session.SqlSession;

/**
 * A MySQL-specific implementation of JDBCEnvironment provides database
 * properties specifically for MySQL.
 */
public class MySQLEnvironment extends JDBCEnvironment {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(MySQLEnvironment.class);

    /**
     * The earliest version of MariaDB that supported recursive CTEs.
     */
    private static final MySQLVersion MARIADB_SUPPORTS_CTE = new MySQLVersion(10, 2, 2, true);

    /**
     * The earliest version of MySQL that supported recursive CTEs.
     */
    private static final MySQLVersion MYSQL_SUPPORTS_CTE = new MySQLVersion(8, 0, 1, false);

    /**
     * The default host to connect to, if MYSQL_HOSTNAME is not specified.
     */
    private static final String DEFAULT_HOSTNAME = "localhost";

    /**
     * The default port to connect to, if MYSQL_PORT is not specified.
     */
    private static final int DEFAULT_PORT = 3306;

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
     * allowed per user to any one connection.
     */
    private final int DEFAULT_MAX_CONNECTIONS_PER_USER = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed per user to any one connection group.
     */
    private final int DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER = 1;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection.
     */
    private final int DEFAULT_MAX_CONNECTIONS = 0;

    /**
     * The default value for the default maximum number of connections to be
     * allowed to any one connection group.
     */
    private final int DEFAULT_MAX_GROUP_CONNECTIONS = 0;

    /**
     * The default SSL mode for connecting to MySQL servers.
     */
    private final MySQLSSLMode DEFAULT_SSL_MODE = MySQLSSLMode.PREFERRED;
    
    /**
     * The default maximum number of identifiers/parameters to be included in a 
     * single batch when executing SQL statements for MySQL and MariaDB.
     * 
     * MySQL and MariaDB impose a limit on the maximum size of a query, 
     * determined by the max_allowed_packet configuration variable. A value of 
     * 1000 is chosen to accommodate the max_allowed_packet limit without 
     * exceeding it.
     *
     * @see https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_allowed_packet
     * @see https://mariadb.com/kb/en/server-system-variables/#max_allowed_packet
     */
    private static final int DEFAULT_BATCH_SIZE = 1000;

    /**
     * Constructs a new MySQLEnvironment, providing access to MySQL-specific
     * configuration options.
     *
     * @throws GuacamoleException
     *     If an error occurs while setting up the underlying JDBCEnvironment
     *     or while parsing legacy MySQL configuration options.
     */
    public MySQLEnvironment() throws GuacamoleException {

        // Init underlying JDBC environment
        super();

    }

    @Override
    public boolean isUserRequired() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_USER_REQUIRED,
            DEFAULT_USER_REQUIRED
        );
    }

    @Override
    public int getAbsoluteMaxConnections() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_ABSOLUTE_MAX_CONNECTIONS,
            DEFAULT_ABSOLUTE_MAX_CONNECTIONS
        );
    }
    
    @Override
    public int getBatchSize() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_BATCH_SIZE,
            DEFAULT_BATCH_SIZE
        );
    }

    @Override
    public int getDefaultMaxConnections() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_DEFAULT_MAX_CONNECTIONS,
            DEFAULT_MAX_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxGroupConnections() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_DEFAULT_MAX_GROUP_CONNECTIONS,
            DEFAULT_MAX_GROUP_CONNECTIONS
        );
    }

    @Override
    public int getDefaultMaxConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_DEFAULT_MAX_CONNECTIONS_PER_USER,
            DEFAULT_MAX_CONNECTIONS_PER_USER
        );
    }

    @Override
    public int getDefaultMaxGroupConnectionsPerUser() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER,
            DEFAULT_MAX_GROUP_CONNECTIONS_PER_USER
        );
    }

    @Override
    public PasswordPolicy getPasswordPolicy() {
        return new MySQLPasswordPolicy(this);
    }

    /**
     * Returns the MySQL driver that will be used to talk to the MySQL-compatible
     * database server hosting the Guacamole database. If unspecified, the
     * installed MySQL driver will be automatically detected by inspecting the
     * classes available in the classpath.
     *
     * @return
     *     The MySQL driver that will be used to communicate with the MySQL-
     *     compatible server.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if no MySQL-compatible
     *     JDBC driver is present.
     */
    public MySQLDriver getMySQLDriver() throws GuacamoleException {

        // Use any explicitly-specified driver
        MySQLDriver driver = getProperty(MySQLGuacamoleProperties.MYSQL_DRIVER);
        if (driver != null)
            return driver;

        // Attempt autodetection based on presence of JDBC driver within
        // classpath...

        if (MySQLDriver.MARIADB.isInstalled()) {
            logger.info("Installed JDBC driver for MySQL/MariaDB detected as \"MariaDB Connector/J\".");
            return MySQLDriver.MARIADB;
        }

        if (MySQLDriver.MYSQL.isInstalled()) {
            logger.info("Installed JDBC driver for MySQL/MariaDB detected as \"MySQL Connector/J\".");
            return MySQLDriver.MYSQL;
        }

        // No driver found at all
        throw new GuacamoleServerException("No JDBC driver for MySQL/MariaDB is installed.");

    }

    /**
     * Returns the hostname of the MySQL server hosting the Guacamole
     * authentication tables. If unspecified, this will be "localhost".
     *
     * @return
     *     The URL of the MySQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public String getMySQLHostname() throws GuacamoleException {
        return getProperty(
            MySQLGuacamoleProperties.MYSQL_HOSTNAME,
            DEFAULT_HOSTNAME
        );
    }

    /**
     * Returns the port number of the MySQL server hosting the Guacamole
     * authentication tables. If unspecified, this will be the default MySQL
     * port of 3306.
     *
     * @return
     *     The port number of the MySQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value.
     */
    public int getMySQLPort() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_PORT, DEFAULT_PORT);
    }

    /**
     * Returns the name of the MySQL database containing the Guacamole
     * authentication tables.
     *
     * @return
     *     The name of the MySQL database.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the property value, or if the
     *     value was not set, as this property is required.
     */
    public String getMySQLDatabase() throws GuacamoleException {
        return getRequiredProperty(MySQLGuacamoleProperties.MYSQL_DATABASE);
    }

    @Override
    public String getUsername() throws GuacamoleException {
        return getRequiredProperty(MySQLGuacamoleProperties.MYSQL_USERNAME);
    }

    @Override
    public String getPassword() throws GuacamoleException {
        return getRequiredProperty(MySQLGuacamoleProperties.MYSQL_PASSWORD);
    }

    @Override
    public boolean isRecursiveQuerySupported(SqlSession session) {

        // Retrieve database version string from JDBC connection
        String versionString;
        try {
            Connection connection = session.getConnection();
            DatabaseMetaData metaData = connection.getMetaData();
            versionString = metaData.getDatabaseProductVersion();
        }
        catch (SQLException e) {
            throw new PersistenceException("Cannot determine whether "
                    + "MySQL / MariaDB supports recursive queries.", e);
        }

        try {

            // Parse MySQL / MariaDB version from version string
            MySQLVersion version = new MySQLVersion(versionString);
            logger.debug("Database recognized as {}.", version);

            // Recursive queries are supported for MariaDB 10.2.2+ and
            // MySQL 8.0.1+
            return version.isAtLeast(MARIADB_SUPPORTS_CTE)
                || version.isAtLeast(MYSQL_SUPPORTS_CTE);

        }
        catch (IllegalArgumentException e) {
            logger.debug("Unrecognized MySQL / MariaDB version string: "
                    + "\"{}\". Assuming database engine does not support "
                    + "recursive queries.", session);
            return false;
        }

    }

    /**
     * Return the MySQL SSL mode as configured in guacamole.properties, or the
     * default value of PREFERRED if not configured.
     *
     * @return
     *     The SSL mode to use when connecting to the MySQL server.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the property value.
     */
    public MySQLSSLMode getMySQLSSLMode() throws GuacamoleException {
        return getProperty(
                MySQLGuacamoleProperties.MYSQL_SSL_MODE,
                DEFAULT_SSL_MODE);
    }

    /**
     * Returns the File where the trusted certificate store is located as
     * configured in guacamole.properties, or null if no value has been
     * configured.  The trusted certificate store is used to validate server
     * certificates when making SSL connections to MySQL servers.
     *
     * @return
     *     The File where the trusted certificate store is located, or null
     *     if the value has not been configured.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public File getMySQLSSLTrustStore() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_SSL_TRUST_STORE);
    }

    /**
     * Returns the password used to access the trusted certificate store as
     * configured in guacamole.properties, or null if no password has been
     * specified.
     *
     * @return
     *     The password used to access the trusted certificate store.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getMySQLSSLTrustPassword() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_SSL_TRUST_PASSWORD);
    }

    /**
     * Returns the File used to store the client SSL certificate as configured
     * in guacamole.properties, or null if no value has been specified.  This
     * file will be used to load the client certificate used for SSL connections
     * to MySQL servers, if the SSL connection is so configured to require
     * client certificate authentication.
     *
     * @return
     *     The File where the client SSL certificate is stored.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public File getMySQLSSLClientStore() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_SSL_CLIENT_STORE);
    }

    /**
     * Returns the password used to access the client certificate store as
     * configured in guacamole.properties, or null if no value has been
     * specified.
     *
     * @return
     *     The password used to access the client SSL certificate store.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getMYSQLSSLClientPassword() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_SSL_CLIENT_PASSWORD);
    }

    @Override
    public boolean autoCreateAbsentAccounts() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.MYSQL_AUTO_CREATE_ACCOUNTS,
                false);
    }

    /**
     * Return the server timezone if configured in guacamole.properties, or
     * null if the configuration option is not present.
     *
     * @return
     *     The server timezone as configured in guacamole.properties.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the configuration value.
     */
    public TimeZone getServerTimeZone() throws GuacamoleException {
        return getProperty(MySQLGuacamoleProperties.SERVER_TIMEZONE);
    }

    @Override
    public boolean trackExternalConnectionHistory() throws GuacamoleException {

        // Track external connection history unless explicitly disabled
        return getProperty(MySQLGuacamoleProperties.MYSQL_TRACK_EXTERNAL_CONNECTION_HISTORY,
                true);
    }

    @Override
    public boolean enforceAccessWindowsForActiveSessions() throws GuacamoleException {

        // Enforce access window restrictions for active sessions unless explicitly disabled
        return getProperty(
                MySQLGuacamoleProperties.MYSQL_ENFORCE_ACCESS_WINDOWS_FOR_ACTIVE_SESSIONS,
                true
        );
    }

}
