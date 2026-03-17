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
## @fn 010-map-guacamole-extensions.sh
##
## Maps all installed Guacamole extensions (built in a previous step) to their
## corresponding environment variable prefixes, adding symbolic links so that
## the changes to the contents of GUACAMOLE_HOME can be easily made by the
## container's entrypoint based on which environment variables are set, without
## requiring that the entrypoint be specifically aware of all supported
## environment variables.
##

##
## Reads a mapping of Guacamole extension to environment variable prefix from
## STDIN, creating a hierarchy of directories and symbolic links on the
## filesystem that can be easily consumed by the container's entrypoint later.
##
## Each mapping consists of a single line with two values separated by
## whitespace, where the first (leftmost) value is the path to the directory
## containing the extension .jar file (relative to /opt/guacamole/extensions)
## and the second (rightmost) value is the environment variable prefix used by
## that extension. For readability, periods may be used in lieu of spaces.
##
## After mapping has occurred, the resulting mappings are located beneath
## /opt/guacamole/environment. They consist of directories named after the
## provided environment variable prefixes, where the contents of those
## directories are subsets of the contents of GUACAMOLE_HOME that would need to
## be added to the actual GUACAMOLE_HOME to enable that extension.
##
map_extensions() {

    # Read through each provided path/prefix mapping pair
    mkdir -p "$DESTINATION/environment"
    tr . ' ' | while read -r EXT_PATH VAR_PREFIX; do

        # Add mappings only for extensions that were actually built as part of
        # the build process (some extensions, like the RADIUS support, will
        # only be built if specific build arguments are provided)
        if [ -d "$DESTINATION/extensions/$EXT_PATH/" ]; then
            echo "Mapped: $EXT_PATH -> $VAR_PREFIX"
            mkdir -p "$DESTINATION/environment/$VAR_PREFIX/extensions"
            ln -s "$DESTINATION/extensions/$EXT_PATH"/*.jar "$DESTINATION/environment/$VAR_PREFIX/extensions/"
        else
            echo "Skipped: $EXT_PATH (not built)"
        fi

    done

}

#
# This section is a mapping of all bundled extensions to their corresponding
# variable prefixes. Each line consists of a whitespace-separated pair of
# extension path (the relative directory containing the .jar file) to that
# extension's variable prefix. For readability, a period may be used in lieu of
# a space.
#
# NOTES:
#
# (1) The actual variables used by each extension are not determined here, but
# rather by the transformation of their configuration properties to variables
# ("lowercase-with-dashes" to "UPPERCASE_WITH_UNDERSCORES"). The variable
# prefixes listed here should be chosen to match the prefixes resulting from
# that transformation of the extensions' properties.
#
# (2) The paths on the left side of this mapping are the paths of the extension
# .jar files relative to the "/opt/guacamole/extensions" directory used by the
# container to store extensions prior to use. They are identical to the paths
# used by the distribution .tar.gz files provided with each Guacamole release,
# except that the version numbers have been stripped from the top-level path.
#
# (3) The script processing this file uses these prefixes to define and process
# an additional "ENABLED" variable (ie: "BAN_ENABLED", "TOTP_ENABLED", etc.)
# that can be used to enable/disable an extension entirely regardless of the
# presence/absence of other variables with the prefix. This allows extensions
# that need no configuration to be easily enabled. It also allows extensions
# that already have configuration present to be easily disabled without
# requiring that all other configuration be removed.
#
map_extensions <<'EOF'
    guacamole-auth-ban..........................BAN_
    guacamole-auth-duo..........................DUO_
    guacamole-auth-header.......................HTTP_AUTH_
    guacamole-auth-jdbc/mysql...................MYSQL_
    guacamole-auth-jdbc/postgresql..............POSTGRESQL_
    guacamole-auth-jdbc/sqlserver...............SQLSERVER_
    guacamole-auth-json.........................JSON_
    guacamole-auth-ldap.........................LDAP_
    guacamole-auth-quickconnect.................QUICKCONNECT_
    guacamole-auth-radius.......................RADIUS_
    guacamole-auth-restrict.....................RESTRICT_
    guacamole-auth-sso/cas......................CAS_
    guacamole-auth-sso/openid...................OPENID_
    guacamole-auth-sso/saml.....................SAML_
    guacamole-auth-sso/ssl......................SSL_AUTH_
    guacamole-auth-totp.........................TOTP_
    guacamole-display-statistics................DISPLAY_STATISTICS_
    guacamole-history-recording-storage.........RECORDING_
    guacamole-vault/ksm.........................KSM_
EOF

