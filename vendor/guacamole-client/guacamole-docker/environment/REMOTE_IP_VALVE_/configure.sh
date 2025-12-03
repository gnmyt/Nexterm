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
## @fn REMOTE_IP_VALVE_/configure.sh
##
## Configures Tomcat to forward the IP addresses of clients behind a proxy if
## the REMOTE_IP_VALVE_ENABLED environment variable is set to "true".
##

##
## Array of all xmlstarlet command-line options necessary to add the
## RemoteIpValve attributes that correspond to various "REMOTE_IP_VALVE_*"
## environment variables.
##
declare -a VALVE_ATTRIBUTES=( --insert '/Server/Service/Engine/Host/Valve[not(@className)]' --type attr -n className -v org.apache.catalina.valves.RemoteIpValve )

# Translate all properties supported by RemoteIpValve into corresponding
# environment variables
for ATTRIBUTE in \
    remoteIpHeader \
    internalProxies \
    proxiesHeader \
    trustedProxies \
    protocolHeader \
    protocolHeaderHttpsValue \
    httpServerPort \
    httpsServerPort; do

    VAR_NAME="REMOTE_IP_VALVE_$(echo "$ATTRIBUTE" | sed 's/\([a-z]\)\([A-Z]\)/\1_\2/g' | tr 'a-z' 'A-Z')"
    if [ -n "${!VAR_NAME}" ]; then
        VALVE_ATTRIBUTES+=( --insert '/Server/Service/Engine/Host/Valve[@className="org.apache.catalina.valves.RemoteIpValve"]' --type attr -n "$ATTRIBUTE" -v "${!VAR_NAME}" )
    else
        echo "Using default RemoteIpValve value for \"$ATTRIBUTE\" attribute."
    fi

done

# Programmatically add requested RemoteIpValve entry
xmlstarlet edit --inplace \
    --insert '/Server/Service/Engine/Host/*' --type elem -n Valve \
    "${VALVE_ATTRIBUTES[@]}" \
    "$CATALINA_BASE/conf/server.xml"

