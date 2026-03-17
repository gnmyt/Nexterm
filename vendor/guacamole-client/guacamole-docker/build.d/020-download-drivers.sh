#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

##
## @fn 020-download-drivers.sh
##
## Downloads all JDBC drivers required by the various supported databases. Each
## downloaded driver is stored beneath /opt/guacamole/drivers, with symbolic
## links added to the mappings beneath /opt/guacamole/environment to ensure any
## required drivers are added to GUACAMOLE_HOME if necessary to support a
## requested database.
##

##
## Downloads the JDBC driver at the given URL, storing the driver's .jar file
## under the given name and environment variable prefix. The downloaded .jar
## file is stored such that it is pulled into GUACAMOLE_HOME automatically if
## environment variables with that prefix are used.
##
## If the URL is for a .tar.gz file and not a .jar file, the .jar will be
## automatically extracted from the .tar.gz as it is downloaded.
##
## @param VAR_PREFIX
##     The environment variable prefix used by the extension that requires the
##     driver.
##
## @param URL
##     The URL that the driver should be downloaded from.
##
## @param DEST_JAR
##     The filename to assign to the downloaded .jar file. This is mainly
##     needed to ensure that the drivers bundled with the image have names that
##     are predictable and reliable enough that they can be consumed by
##     third-party use of this image.
##
download_driver() {

    local VAR_PREFIX="$1"
    local URL="$2"
    local DEST_JAR="$3"

    # Ensure primary destination path for .jar file exists
    local DEST_PATH="$DESTINATION/drivers/"
    mkdir -p "$DEST_PATH"

    # Download requested .jar file, extracting from .tar.gz if necessary
    if [[ "$URL" == *.tar.gz ]]; then
        curl -L "$URL" | tar -xz       \
            --wildcards                \
            --no-anchored              \
            --no-wildcards-match-slash \
            --to-stdout                \
            "*.jar" > "$DEST_PATH/$DEST_JAR"
    else
        curl -L "$URL" > "$DEST_PATH/$DEST_JAR"
    fi

    # Add any required link to ensure the .jar file is loaded along with the
    # extension that requires it
    mkdir -p "$DESTINATION/environment/$VAR_PREFIX/lib"
    ln -s "$DEST_PATH/$DEST_JAR" "$DESTINATION/environment/$VAR_PREFIX/lib/"

}

#
# Download and link any required JDBC drivers
#

# MySQL JDBC driver
download_driver "MYSQL_" \
    "https://dev.mysql.com/get/Downloads/Connector-J/mysql-connector-j-$MYSQL_JDBC_VERSION.tar.gz" \
    "mysql-jdbc.jar"

# PostgreSQL JDBC driver
download_driver "POSTGRESQL_" \
    "https://jdbc.postgresql.org/download/postgresql-$PGSQL_JDBC_VERSION.jar" \
    "postgresql-jdbc.jar"

# SQL Server JDBC driver
download_driver "SQLSERVER_" \
    "https://github.com/microsoft/mssql-jdbc/releases/download/v$MSSQL_JDBC_VERSION/mssql-jdbc-$MSSQL_JDBC_VERSION.jre8.jar" \
    "mssql-jdbc.jar"

