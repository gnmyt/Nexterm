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

package org.apache.guacamole.auth.jdbc;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Properties;
import org.apache.guacamole.GuacamoleException;
import org.apache.ibatis.datasource.pooled.PooledDataSource;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Pooled DataSource implementation which dynamically retrieves the database
 * username and password from the Guacamole server environment each time a
 * new database connection is created.
 */
@Singleton
public class DynamicallyAuthenticatedDataSource extends PooledDataSource {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(DynamicallyAuthenticatedDataSource.class);

    /**
     * Creates a new DynamicallyAuthenticatedDataSource which dynamically
     * retrieves database credentials from the given JDBCEnvironment each time
     * a new database connection is needed.
     *
     * @param environment
     *     The JDBCEnvironment that should be used to retrieve database
     *     credentials.
     *
     * @param driverClassLoader
     * @param driver
     * @param url
     */
    @Inject
    public DynamicallyAuthenticatedDataSource(JDBCEnvironment environment,
            @Named(value="JDBC.driverClassLoader") ClassLoader driverClassLoader,
            @Named(value="JDBC.driver") String driver,
            @Named(value="JDBC.url") String url) {

        // Wrap unpooled DataSource, overriding the connection process such
        // that credentials are dynamically retrieved from the JDBCEnvironment
        super(new UnpooledDataSource(driverClassLoader, driver, url, null, null) {

            @Override
            public Connection getConnection() throws SQLException {
                try {
                    logger.debug("Creating new database connection for pool.");
                    return super.getConnection(environment.getUsername(), environment.getPassword());
                }
                catch (GuacamoleException e) {
                    throw new SQLException("Retrieval of database credentials failed.", e);
                }
            }

        });

        // Force recalculation of expectedConnectionTypeCode. The
        // PooledDataSource constructor accepting a single UnpooledDataSource
        // will otherwise leave this value uninitialized, resulting in all
        // connections failing to pass sanity checks and never being returned
        // to the pool.
        super.forceCloseAll();

    }

    @Override
    @Inject(optional=true)
    public void setPoolPingConnectionsNotUsedFor(
            @Named("mybatis.pooled.pingConnectionsNotUsedFor") int milliseconds) {
        super.setPoolPingConnectionsNotUsedFor(milliseconds);
    }

    @Override
    @Inject(optional=true)
    public void setPoolPingEnabled(@Named("mybatis.pooled.pingEnabled") boolean poolPingEnabled) {
        super.setPoolPingEnabled(poolPingEnabled);
    }

    @Override
    @Inject(optional=true)
    public void setPoolPingQuery(@Named("mybatis.pooled.pingQuery") String poolPingQuery) {
        super.setPoolPingQuery(poolPingQuery);
    }

    @Override
    @Inject(optional=true)
    public void setPoolTimeToWait(@Named("mybatis.pooled.timeToWait") int poolTimeToWait) {
        super.setPoolTimeToWait(poolTimeToWait);
    }

    @Override
    @Inject(optional=true)
    public void setPoolMaximumCheckoutTime(
            @Named("mybatis.pooled.maximumCheckoutTime") int poolMaximumCheckoutTime) {
        super.setPoolMaximumCheckoutTime(poolMaximumCheckoutTime);
    }

    @Override
    @Inject(optional=true)
    public void setPoolMaximumIdleConnections(
            @Named("mybatis.pooled.maximumIdleConnections") int poolMaximumIdleConnections) {
        super.setPoolMaximumIdleConnections(poolMaximumIdleConnections);
    }

    @Override
    @Inject(optional=true)
    public void setPoolMaximumActiveConnections(
            @Named("mybatis.pooled.maximumActiveConnections") int poolMaximumActiveConnections) {
        super.setPoolMaximumActiveConnections(poolMaximumActiveConnections);
    }

    @Override
    @Inject(optional=true)
    public void setDriverProperties(@Named("JDBC.driverProperties") Properties driverProps) {
        super.setDriverProperties(driverProps);
    }

    @Override
    @Inject(optional=true)
    public void setDefaultAutoCommit(@Named("JDBC.autoCommit") boolean defaultAutoCommit) {
        super.setDefaultAutoCommit(defaultAutoCommit);
    }

    @Override
    @Inject(optional=true)
    public void setLoginTimeout(@Named("JDBC.loginTimeout") int loginTimeout) {
        super.setLoginTimeout(loginTimeout);
    }

}
