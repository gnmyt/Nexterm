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

import com.google.inject.Binder;
import com.google.inject.Module;
import com.google.inject.name.Names;
import java.io.File;
import java.util.Properties;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.postgresql.conf.PostgreSQLEnvironment;
import org.apache.guacamole.auth.postgresql.conf.PostgreSQLSSLMode;
import org.mybatis.guice.datasource.helper.JdbcHelper;

/**
 * Guice module which configures PostgreSQL-specific injections.
 */
public class PostgreSQLAuthenticationProviderModule implements Module {

    /**
     * MyBatis-specific configuration properties.
     */
    private final Properties myBatisProperties = new Properties();

    /**
     * PostgreSQL-specific driver configuration properties.
     */
    private final Properties driverProperties = new Properties();
    
    /**
     * Creates a new PostgreSQL authentication provider module that configures
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
    public PostgreSQLAuthenticationProviderModule(PostgreSQLEnvironment environment)
            throws GuacamoleException {

        // Set the PostgreSQL-specific properties for MyBatis.
        myBatisProperties.setProperty("mybatis.environment.id", "guacamole");
        myBatisProperties.setProperty("JDBC.host", environment.getPostgreSQLHostname());
        myBatisProperties.setProperty("JDBC.port", String.valueOf(environment.getPostgreSQLPort()));
        myBatisProperties.setProperty("JDBC.schema", environment.getPostgreSQLDatabase());
        myBatisProperties.setProperty("JDBC.autoCommit", "false");
        myBatisProperties.setProperty("mybatis.pooled.pingEnabled", "true");
        myBatisProperties.setProperty("mybatis.pooled.pingQuery", "SELECT 1");

        // Only set if > 0. Underlying backend does not take 0 as not-set.
        int defaultStatementTimeout = environment.getPostgreSQLDefaultStatementTimeout();
        if (defaultStatementTimeout > 0) {
            myBatisProperties.setProperty(
                "mybatis.configuration.defaultStatementTimeout",
                String.valueOf(defaultStatementTimeout)
            );
        }

        // Use UTF-8 in database
        driverProperties.setProperty("characterEncoding", "UTF-8");
        
        // Check the SSL mode and set if configured.
        PostgreSQLSSLMode sslMode = environment.getPostgreSQLSSLMode();
        
        /**
         * Older versions of the PostgreSQL JDBC driver do not support directly
         * setting the "prefer" mode; however, the behavior defined by this
         * mode is the default if nothing is set, so if that mode is requested
         * in guacamole.properties we just don't set sslmode in the driver.
         */
        if (sslMode != PostgreSQLSSLMode.PREFER)
            driverProperties.setProperty("sslmode", sslMode.getDriverValue());
        
        // If SSL is requested disabled, also set the legacy property.
        if (sslMode == PostgreSQLSSLMode.DISABLE)
            driverProperties.setProperty("ssl", "false");
        
        // If SSL is enabled, check for and set other SSL properties.
        else {
            
            File sslClientCert = environment.getPostgreSQLSSLClientCertFile();
            if (sslClientCert != null)
                driverProperties.setProperty("sslcert", sslClientCert.getAbsolutePath());
            
            File sslClientKey = environment.getPostgreSQLSSLClientKeyFile();
            if (sslClientKey != null)
                driverProperties.setProperty("sslkey", sslClientKey.getAbsolutePath());
            
            File sslRootCert = environment.getPostgreSQLSSLClientRootCertFile();
            if (sslRootCert != null)
                driverProperties.setProperty("sslrootcert", sslRootCert.getAbsolutePath());
            
            String sslClientKeyPassword = environment.getPostgreSQLSSLClientKeyPassword();
            if (sslClientKeyPassword != null)
                driverProperties.setProperty("sslpassword", sslClientKeyPassword);
            
        }

        // Handle case where TCP connection to database is silently dropped
        driverProperties.setProperty(
            "socketTimeout",
            String.valueOf(environment.getPostgreSQLSocketTimeout())
        );

    }

    @Override
    public void configure(Binder binder) {

        // Bind PostgreSQL-specific properties
        JdbcHelper.PostgreSQL.configure(binder);
        
        // Bind MyBatis properties
        Names.bindProperties(binder, myBatisProperties);

        // Bind JDBC driver properties
        binder.bind(Properties.class)
            .annotatedWith(Names.named("JDBC.driverProperties"))
            .toInstance(driverProperties);

    }

}
