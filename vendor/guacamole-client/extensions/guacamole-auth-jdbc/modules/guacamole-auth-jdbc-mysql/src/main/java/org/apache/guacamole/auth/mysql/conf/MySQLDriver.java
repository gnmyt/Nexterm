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

import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * The possible JDBC drivers to use when talking to a MySQL-compatible database
 * server.
 */
public enum MySQLDriver {

    /**
     * MySQL driver.
     */
    @PropertyValue("mysql")
    MYSQL("com.mysql.jdbc.Driver"),

    /**
     * MariaDB driver.
     */
    @PropertyValue("mariadb")
    MARIADB("org.mariadb.jdbc.Driver");

    /**
     * The name of the JDBC driver class.
     */
    private final String driverClass;

    /**
     * Creates a new MySQLDriver that points to the given Java class as the
     * entrypoint of the JDBC driver.
     *
     * @param classname
     *     The name of the JDBC driver class.
     */
    private MySQLDriver(String classname) {
        this.driverClass = classname;
    }

    /**
     * Returns whether this MySQL JDBC driver is installed and can be found
     * within the Java classpath.
     *
     * @return
     *     true if this MySQL JDBC driver is installed, false otherwise.
     */
    public boolean isInstalled() {
        return JDBCEnvironment.isClassDefined(driverClass);
    }

}