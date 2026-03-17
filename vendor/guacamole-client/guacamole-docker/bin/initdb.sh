#!/bin/sh -e
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
## @fn initdb.sh
##
## Generates a database initialization SQL script for a database of the given
## type. The SQL will be sent to STDOUT.
##
## @param DATABASE
##     The database to generate the SQL script for. This may be either
##     "--postgresql", for PostgreSQL, "--mysql" for MySQL, or "--sqlserver" for Microsoft SQL Server.
##

DATABASE="$1"

##
## Prints usage information for this shell script and exits with an error code.
## Calling this function will immediately terminate execution of the script.
##
incorrect_usage() {
    cat <<END
USAGE: /opt/guacamole/bin/initdb.sh [--postgresql | --mysql | --sqlserver]
END
    exit 1
}

# Validate parameters
if [ "$#" -ne 1 ]; then
    echo "Wrong number of arguments."
    incorrect_usage
fi

#
# Produce script
#

case $DATABASE in

    --postgresql)
        cat /opt/guacamole/extensions/guacamole-auth-jdbc/postgresql/schema/*.sql
        ;;

    --mysql)
        cat /opt/guacamole/extensions/guacamole-auth-jdbc/mysql/schema/*.sql
        ;;

    --sqlserver)
        cat /opt/guacamole/extensions/guacamole-auth-jdbc/sqlserver/schema/*.sql
        ;;

    *)
        echo "Bad database type: $DATABASE"
        incorrect_usage
esac

