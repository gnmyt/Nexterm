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
#

##
## @fn 700-configure-features.sh
##
## Automatically checks all environment variables currently set and performs
## configuration tasks related to those variabels, including installing any
## extensions and external libraries associated with those variables to
## GUACAMOLE_HOME.  Only environment variable prefixes are considered; this
## script is not aware of whether an extension actually uses an environment
## variable.
##

##
## Returns whether the feature associated with a particular environment
## variable prefix has configuration values set. Only the presence of
## environment variables having that prefix is checked. Features can also be
## entirely enabled/disabled through setting the [PREFIX_]ENABLED variable to
## true/false respectively, where "[PREFIX_]" is the specified environment
## variable prefix (including trailing underscore).
##
## @param VAR_BASE
##     The environment variable prefix to check, including trailing underscore.
##
## @returns
##     Zero if the feature associated with the given environment variable
##     prefix is enabled, non-zero otherwise.
##
is_feature_enabled() {

    local VAR_BASE="$1"

    # Allow any feature to be explicitly enabled/disabled using a
    # [PREFIX_]ENABLED variable
    local ENABLED_VAR="${VAR_BASE}ENABLED"
    if [ "${!ENABLED_VAR}" = "true" ]; then
        return 0
    elif [ "${!ENABLED_VAR}" = "false" ]; then
        return 1
    fi

    # Lacking an explicit request to enable/disable the feature, rely on
    # implicit enable/disable via presence of any other variables having the
    # given prefix
    awk 'BEGIN{for(v in ENVIRON) print v}' | grep "^${VAR_BASE}" > /dev/null

}

# Search environment for enabled extensions/features based on environment
# variable prefixes
for VAR_BASE in /opt/guacamole/environment/*; do

    # Skip any directories without at least one corresponding environment
    # variable set
    is_feature_enabled "$(basename "$VAR_BASE")" || continue

    # Execute any associated configuration script
    [ ! -e "$VAR_BASE/configure.sh" ] || source "$VAR_BASE/configure.sh"

    # Add any required links for extensions/libraries associated with the
    # configured extension
    for SUBDIR in lib extensions; do
        if [ -d "$VAR_BASE/$SUBDIR" ]; then
            mkdir -p "$GUACAMOLE_HOME/$SUBDIR/"
            ln -s "$VAR_BASE/$SUBDIR"/* "$GUACAMOLE_HOME/$SUBDIR/"
        fi
    done

done

