#!/bin/bash -e
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
## @fn entrypoint.sh
##
## (Re-)configures the Apache Guacamole web application based on the values of
## environment variables, deploys the web application beneath a bundled copy of
## Apache Tomcat, and starts Tomcat.
##
## The startup process is split across multiple scripts within the
## /opt/guacamole/entrypoint.d directory. Additional steps may be added to the
## startup process by adding .sh scripts to this directory. Any such scripts
## MUST be shell scripts ending with a ".sh" extension and MUST be written for
## bash (the shell used by this entrypoint).
##

# Run all scripts within the "entrypoint.d" directory
for SCRIPT in /opt/guacamole/entrypoint.d/*.sh; do
    source "$SCRIPT"
done

