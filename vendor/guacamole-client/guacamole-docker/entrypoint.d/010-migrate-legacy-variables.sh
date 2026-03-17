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
## @fn 010-migrate-legacy-variables.sh
##
## Checks for usage of any environment variables that were formerly supported
## but are now deprecated, warning when any deprecated variables are
## encountered.  Until support for a deprecated variable is entirely removed,
## the value provided for the deprecated variable is automatically assigned to
## the currently-supported variable.
##

##
## Checks for usage of the given deprecated environment variable, automatically
## assigning its value to the given currently-supported environment variable.
## If usage of the deprecated variable is found, a warning is printed to
## STDERR.
##
## @param LEGACY_VAR_NAME
##     The name of the environment variable that's deprecated.
##
## @param CURRENT_VAR_NAME
##     The name of the environment variable that is currently supported and
##     replaces the deprecated variable.
##
deprecate_variable() {

    local LEGACY_VAR_NAME="$1"
    local CURRENT_VAR_NAME="$2"

    if [ -n "${!LEGACY_VAR_NAME}" ]; then
        echo "WARNING: The \"$LEGACY_VAR_NAME\" environment variable has been deprecated in favor of \"$CURRENT_VAR_NAME\". Please migrate your configuration when possible, as support for the older name may be removed in future releases." >&2
        export "$CURRENT_VAR_NAME"="${!LEGACY_VAR_NAME}"
    fi

}

##
## Checks for usage of any environment variables using the given deprecated
## prefix, automatically assigning their values to corresponding environment
## variables having the given currently-supported prefix. If usage of the
## deprecated prefix is found, a warning is printed to STDERR.
##
## @param LEGACY_VAR_PREFIX
##     The environment variable prefix that's deprecated.
##
## @param CURRENT_VAR_PREFIX
##     The environment variable prefix that is currently supported and
##     replaces the deprecated variable prefix.
##
deprecate_variable_prefix() {

    local LEGACY_VAR_PREFIX="$1"
    local CURRENT_VAR_PREFIX="$2"

    local LEGACY_VAR_NAME
    local CURRENT_VAR_NAME
    local HAS_LEGACY_VARIABLES=0

    # Automatically reassign all "POSTGRES_*" variables to "POSTGRESQL_*"
    while read -r LEGACY_VAR_NAME; do
        HAS_LEGACY_VARIABLES=1
        CURRENT_VAR_NAME="$CURRENT_VAR_PREFIX${LEGACY_VAR_NAME#$LEGACY_VAR_PREFIX}"
        export "$CURRENT_VAR_NAME"="${!LEGACY_VAR_NAME}"
        unset "$LEGACY_VAR_NAME"
    done < <(awk 'BEGIN{for(v in ENVIRON) print v}' | grep "^$LEGACY_VAR_PREFIX")

    if [ "$HAS_LEGACY_VARIABLES" = "1" ]; then
        echo "WARNING: The \"$LEGACY_VAR_PREFIX\" prefix for environment variables has been deprecated in favor of the \"$CURRENT_VAR_PREFIX\" prefix. Please migrate your configuration when possible, as support for the older prefix may be removed in future releases." >&2
        export "$CURRENT_VAR_NAME"="$LEGACY_VAR_NAME"
    fi

}

# The old "*_USER" style for configuring the user account to be used to access
# the database is being replaced with "*_USERNAME" such that all environment
# variables exactly correspond to the names of configuration properties from
# guacamole.properties.
deprecate_variable "MYSQL_USER"      "MYSQL_USERNAME"
deprecate_variable "POSTGRES_USER"   "POSTGRESQL_USERNAME"
deprecate_variable "POSTGRESQL_USER" "POSTGRESQL_USERNAME"
deprecate_variable "SQLSERVER_USER"  "SQLSERVER_USERNAME"

# The old "POSTGRES_" prefix for configuring usage of PostgreSQL is being
# replaced with "POSTGRESQL_" such that all environment variables exactly
# correspond to the names of configuration properties from
# guacamole.properties.
deprecate_variable_prefix "POSTGRES_" "POSTGRESQL_"

# The old "PROXY_*" names for attributes supported by RemoteIpValve are being
# replaced with "REMOTE_IP_VALVE_*" attributes that more closely and
# predictably match their attribute names
deprecate_variable "PROXY_ALLOWED_IPS_REGEX" "REMOTE_IP_VALVE_INTERNAL_PROXIES"
deprecate_variable "PROXY_IP_HEADER"         "REMOTE_IP_VALVE_REMOTE_IP_HEADER"
deprecate_variable "PROXY_PROTOCOL_HEADER"   "REMOTE_IP_VALVE_PROTOCOL_HEADER"
# NOTE: PROXY_BY_HEADER never worked as there is no "remoteIpProxiesHeader" attribute for RemoteIpValve

# The old "LOGBACK_LEVEL" environment variable has been replaced with
# "LOG_LEVEL" for consistency with the guacd image
deprecate_variable "LOGBACK_LEVEL" "LOG_LEVEL"
