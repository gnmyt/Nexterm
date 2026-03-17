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

import com.google.inject.Binder;
import com.google.inject.Module;
import com.google.inject.name.Names;
import java.lang.UnsupportedOperationException;
import java.util.Properties;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.sqlserver.conf.SQLServerDriver;
import org.apache.guacamole.auth.sqlserver.conf.SQLServerEnvironment;
import org.apache.guacamole.properties.CaseSensitivity;
import org.mybatis.guice.datasource.helper.JdbcHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Guice module which configures SQLServer-specific injections.
 */
public class SQLServerAuthenticationProviderModule implements Module {

    /**
     * Logger for this class.
     */
    private static final Logger LOGGER = LoggerFactory.getLogger(SQLServerAuthenticationProviderModule.class);
    
    /**
     * MyBatis-specific configuration properties.
     */
    private final Properties myBatisProperties = new Properties();

    /**
     * SQLServer-specific driver configuration properties.
     */
    private final Properties driverProperties = new Properties();

    /**
     * Which SQL Server driver should be used.
     */
    private final SQLServerDriver sqlServerDriver;

    /**
     * Creates a new SQLServer authentication provider module that configures
     * driver and MyBatis properties using the given environment.
     *
     * @param environment
     *     The environment to use when configuring MyBatis and the underlying
     *     JDBC driver.
     *
     * @throws GuacamoleException
     *     If a required property is missing, or an error occurs while parsing
     *     a property.
     */
    public SQLServerAuthenticationProviderModule(SQLServerEnvironment environment)
            throws GuacamoleException {

        // Set the SQLServer-specific properties for MyBatis.
        myBatisProperties.setProperty("mybatis.environment.id", "guacamole");
        myBatisProperties.setProperty("JDBC.host", environment.getSQLServerHostname());
        myBatisProperties.setProperty("JDBC.port", String.valueOf(environment.getSQLServerPort()));
        myBatisProperties.setProperty("JDBC.schema", environment.getSQLServerDatabase());
        
        myBatisProperties.setProperty("JDBC.autoCommit", "false");
        myBatisProperties.setProperty("mybatis.pooled.pingEnabled", "true");
        myBatisProperties.setProperty("mybatis.pooled.pingQuery", "SELECT 1");

        // Use UTF-8 in database
        driverProperties.setProperty("characterEncoding", "UTF-8");

        // Trust unknown server certificates if configured to do so
        if (environment.trustAllServerCertificates())
            driverProperties.setProperty("trustServerCertificate", "true");
        
        // Retrieve instance name and set it
        String instance = environment.getSQLServerInstance();
        if (instance != null)
            driverProperties.setProperty("JDBC.instanceName", instance);

        // Capture which driver to use for the connection.
        this.sqlServerDriver = environment.getSQLServerDriver();
        
        // Check for case sensitivity and warn admin.
        if (environment.getCaseSensitivity() != CaseSensitivity.DISABLED)
            LOGGER.warn("The SQL Server module is currently configured to support "
                    + "case-sensitive username comparisons, however, the default "
                    + "collations for SQL Server databases do not support "
                    + "case-sensitive string comparisons. If you want usernames "
                    + "within Guacamole to be treated as case-sensitive, further "
                    + "database configuration may be required.");

    }

    @Override
    public void configure(Binder binder) {

        // Bind SQLServer-specific properties with the configured driver.
        switch(sqlServerDriver) {
            case JTDS:
                JdbcHelper.SQL_Server_jTDS.configure(binder);
                break;

            case DATA_DIRECT:
                JdbcHelper.SQL_Server_DataDirect.configure(binder);
                break;

            case MICROSOFT_LEGACY:
                JdbcHelper.SQL_Server_MS_Driver.configure(binder);
                break;

            case MICROSOFT_2005:
                JdbcHelper.SQL_Server_2005_MS_Driver.configure(binder);
                break;

            default:
                throw new UnsupportedOperationException(
                    "A driver has been specified that is not supported by this module."
                );
        }
        
        // Bind MyBatis properties
        Names.bindProperties(binder, myBatisProperties);

        // Bind JDBC driver properties
        binder.bind(Properties.class)
            .annotatedWith(Names.named("JDBC.driverProperties"))
            .toInstance(driverProperties);

    }

}
