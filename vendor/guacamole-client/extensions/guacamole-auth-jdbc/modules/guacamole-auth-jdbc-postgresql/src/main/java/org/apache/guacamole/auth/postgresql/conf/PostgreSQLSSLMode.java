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

import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * Possible values for PostgreSQL SSL connectivity.
 */
public enum PostgreSQLSSLMode {
    
    /**
     * Do not use SSL to connect to server.
     */
    @PropertyValue("disable")
    DISABLE("disable"),
    
    /**
     * Allow SSL connections, but try non-SSL, first.
     */
    @PropertyValue("allow")
    ALLOW("allow"),
    
    /**
     * Prefer SSL connections, falling back to non-SSL if that fails.
     */
    @PropertyValue("prefer")
    PREFER("prefer"),
    
    /**
     * Require SSL connections, do not connect if SSL fails.
     */
    @PropertyValue("require")
    REQUIRE("require"),
    
    /**
     * Require SSL connections and validate the CA certificate.
     */
    @PropertyValue("verify-ca")
    VERIFY_CA("verify-ca"),
    
    /**
     * Require SSL connections and validate both the CA and server certificates.
     */
    @PropertyValue("verify-full")
    VERIFY_FULL("verify-full");
    
    /**
     * The value expected by and passed on to the JDBC driver for the given
     * SSL operation mode.
     */
    private final String driverValue;
    
    /**
     * Create a new instance of this enum with the given driverValue as the
     * value that will be used when configuring the JDBC driver.
     * 
     * @param driverValue
     *     The value to use when configuring the JDBC driver.
     */
    PostgreSQLSSLMode(String driverValue) {
        this.driverValue = driverValue;
    }
    
    /**
     * Returns the String value for a given Enum that properly configures the
     * JDBC driver for the desired mode of SSL operation.
     * 
     * @return 
     *     The String value for the current Enum that configures the JDBC driver
     *     for the desired mode of SSL operation.
     */
    public String getDriverValue() {
        return driverValue;
    }
    
}
