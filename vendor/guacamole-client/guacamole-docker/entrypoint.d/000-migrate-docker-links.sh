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
## @fn 000-migrate-docker-links.sh
##
## Checks for usage of any Docker links that were formerly supported
## but are now deprecated, warning when any deprecated Docker links are
## encountered. Until support for Docker links is entirely removed, the values
## of environment variables that are injected by Docker for deprecated Docker
## links are automatically reassigned to currently supported variables.
##

##
## Unsets all environment variables whose names start with the given prefix.
##
## @param LEGACY_VAR_PREFIX
##     The name prefix of the environment variables that should be unset.
##
unset_starts_with() {

    local LEGACY_VAR_PREFIX="$1"

    local LEGACY_VAR_NAME

    # Unset all environment variables starting with the given prefix
    while read -r LEGACY_VAR_NAME; do
        unset "$LEGACY_VAR_NAME"
    done < <(awk 'BEGIN{for(v in ENVIRON) print v}' | grep "^$LEGACY_VAR_PREFIX")

}

##
## Checks for usage of the given deprecated Docker link, automatically
## assigning the values of its associated environment variables to the given
## set of currently supported environment variables.  If usage of the
## deprecated Docker link is found, a warning is printed to STDERR.
##
## @param LEGACY_LINK_NAME
##     The name of the Docker link that's deprecated, as would be provided to
##     the "docker" command with the "--link" option.
##
## @param LEGACY_LINK_PORT_NUMBER
##     The TCP port number used by the service originally pointed to by the
##     deprecated Docker link. This will be the port number exposed by the
##     Docker image customarily used for that service.
##
## @param CURRENT_ADDR_VAR_NAME
##     The name of the environment variable that is currently supported and
##     represents the IP addresss or hostname of the service originally pointed
##     to by the deprecated Docker link.
##
## @param CURRENT_PORT_VAR_NAME
##     The name of the environment variable that is currently supported and
##     represents the TCP port of the service originally pointed to by the
##     deprecated Docker link.
##
deprecate_link() {

    local LEGACY_LINK_NAME="$1"
    local LEGACY_LINK_PORT_NUMBER="$2"
    local CURRENT_ADDR_VAR_NAME="$3"
    local CURRENT_PORT_VAR_NAME="$4"

    # Determine names of environment variables injected by Docker for the link
    # having the given name
    local LEGACY_LINK_VAR_PREFIX="`echo "$LEGACY_LINK_NAME" | tr 'a-z' 'A-Z'`"
    local LEGACY_LINK_VAR_TCP_PREFIX="${LEGACY_LINK_VAR_PREFIX}_PORT_${LEGACY_LINK_PORT_NUMBER}_TCP"
    local LEGACY_ADDR_VAR_NAME="${LEGACY_LINK_VAR_TCP_PREFIX}_ADDR"
    local LEGACY_PORT_VAR_NAME="${LEGACY_LINK_VAR_TCP_PREFIX}_PORT"

    # NOTE: We pull these values early to ensure we can safely unset the
    # legacy variables without losing the ability to reassign those values to
    # the proper variables later
    local LEGACY_LINK_ADDR="${!LEGACY_ADDR_VAR_NAME}"
    local LEGACY_LINK_PORT="${!LEGACY_PORT_VAR_NAME}"

    if [ -n "$LEGACY_LINK_ADDR" -o -n "$LEGACY_LINK_PORT" ]; then
        echo "WARNING: The \"$LEGACY_LINK_NAME\" Docker link has been deprecated in favor of the \"$CURRENT_ADDR_VAR_NAME\" and \"$CURRENT_PORT_VAR_NAME\" environment variables. Please migrate your configuration when possible, as Docker considers the linking feature to be legacy and support for Docker links may be removed in future releases. See: https://docs.docker.com/engine/network/links/" >&2

        #
        # Clear out any environment variables related to the legacy link (NOTE:
        # this is necessary not only to clean the environment of variables that
        # aren't actually used, but also to avoid tripping warnings about
        # legacy "POSTGRES_" variable naming).
        #
        # The variables that Docker will set are documented here:
        #
        #   https://docs.docker.com/engine/network/links/
        #

        unset "${LEGACY_LINK_VAR_PREFIX}_NAME"
        unset "${LEGACY_LINK_VAR_PREFIX}_PORT"
        unset_starts_with "${LEGACY_LINK_VAR_TCP_PREFIX}_"
        unset_starts_with "${LEGACY_LINK_VAR_PREFIX}_ENV_"

        # A variable containing just the prefix documented by Docker is also
        # injected, but this is not documented at the above URL
        unset "$LEGACY_LINK_VAR_TCP_PREFIX"

        # Migrate legacy Docker link values over to the proper variables
        export "$CURRENT_ADDR_VAR_NAME"="$LEGACY_LINK_ADDR"
        export "$CURRENT_PORT_VAR_NAME"="$LEGACY_LINK_PORT"

    fi

}

# Legacy Docker link support for connecting the webapp image with guacd
deprecate_link "guacd" 4822 "GUACD_HOSTNAME" "GUACD_PORT"

# Legacy Docker link support for connecting the webapp image with the various
# supported databases
deprecate_link "mysql"     3306 "MYSQL_HOSTNAME"      "MYSQL_PORT"
deprecate_link "postgres"  5432 "POSTGRESQL_HOSTNAME" "POSTGRESQL_PORT"
deprecate_link "sqlserver" 1433 "SQLSERVER_HOSTNAME"  "SQLSERVER_PORT"

# No other Docker links have been historically supported by the
# "guacamole/guacamole" image.

