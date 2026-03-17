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

import com.google.common.collect.ComparisonChain;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The specific version of a MySQL or MariaDB server.
 */
public class MySQLVersion {

    /**
     * Pattern which matches the version string returned by a MariaDB server,
     * extracting the major, minor, and patch numbers.
     */
    private final Pattern MARIADB_VERSION = Pattern.compile("^.*-([0-9]+)\\.([0-9]+)\\.([0-9]+)-MariaDB$");

    /**
     * Pattern which matches the version string returned by a non-MariaDB
     * server (including MySQL and Aurora), extracting the major, minor, and
     * patch numbers. All non-MariaDB servers use normal MySQL version numbers.
     */
    private final Pattern MYSQL_VERSION = Pattern.compile("^([0-9]+)\\.([0-9]+)\\.([0-9]+).*$");

    /**
     * Whether the associated server is a MariaDB server. All non-MariaDB
     * servers use normal MySQL version numbers and are comparable against each
     * other.
     */
    private final boolean isMariaDB;

    /**
     * The major component of the MAJOR.MINOR.PATCH version number.
     */
    private final int major;

    /**
     * The minor component of the MAJOR.MINOR.PATCH version number.
     */
    private final int minor;

    /**
     * The patch component of the MAJOR.MINOR.PATCH version number.
     */
    private final int patch;

    /**
     * Creates a new MySQLVersion having the specified major, minor, and patch
     * components.
     *
     * @param major
     *     The major component of the MAJOR.MINOR.PATCH version number of the
     *     MariaDB / MySQL server.
     *
     * @param minor
     *     The minor component of the MAJOR.MINOR.PATCH version number of the
     *     MariaDB / MySQL server.
     *
     * @param patch
     *     The patch component of the MAJOR.MINOR.PATCH version number of the
     *     MariaDB / MySQL server.
     *
     * @param isMariaDB
     *     Whether the associated server is a MariaDB server.
     */
    public MySQLVersion(int major, int minor, int patch, boolean isMariaDB) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.isMariaDB = isMariaDB;
    }

    public MySQLVersion(String version) throws IllegalArgumentException {

        // Extract MariaDB version number if version string appears to be
        // a MariaDB version string
        Matcher mariadb = MARIADB_VERSION.matcher(version);
        if (mariadb.matches()) {
            this.major = Integer.parseInt(mariadb.group(1));
            this.minor = Integer.parseInt(mariadb.group(2));
            this.patch = Integer.parseInt(mariadb.group(3));
            this.isMariaDB = true;
            return;
        }

        // If not MariaDB, assume version string is a MySQL version string
        // and attempt to extract the version number
        Matcher mysql = MYSQL_VERSION.matcher(version);
        if (mysql.matches()) {
            this.major = Integer.parseInt(mysql.group(1));
            this.minor = Integer.parseInt(mysql.group(2));
            this.patch = Integer.parseInt(mysql.group(3));
            this.isMariaDB = false;
            return;
        }

        throw new IllegalArgumentException("Unrecognized MySQL / MariaDB version string.");

    }

    /**
     * Returns whether this version is at least as recent as the given version.
     *
     * @param version
     *     The version to compare against.
     *
     * @return
     *     true if the versions are associated with the same database server
     *     type (MariaDB vs. MySQL) and this version is at least as recent as
     *     the given version, false otherwise.
     */
    public boolean isAtLeast(MySQLVersion version) {

        // If the databases use different version numbering schemes, the
        // version numbers are not comparable
        if (isMariaDB != version.isMariaDB)
            return false;

        // Compare major, minor, and patch number in order of precedence
        return ComparisonChain.start()
                .compare(major, version.major)
                .compare(minor, version.minor)
                .compare(patch, version.patch)
                .result() >= 0;

    }

    @Override
    public String toString() {
        return String.format("%s %d.%d.%d", isMariaDB ? "MariaDB" : "MySQL",
                major, minor, patch);
    }

}
