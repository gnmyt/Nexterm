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
## @fn build-guacamole.sh
##
## Builds Guacamole, saving "guacamole.war" and all applicable extension .jars
## using the guacamole-client source contained within the given directory.
## Extension files will be grouped by their associated type, identical to
## extracting the .tar.gz files included with each Guacamole release except
## that version numbers are stripped from directory and .jar file names.
##
## The build process is split across multiple scripts within the
## /opt/guacamole/build.d directory. Additional steps may be added to the
## build process by adding .sh scripts to this directory. Any such scripts MUST
## be shell scripts ending with a ".sh" extension and MUST be written for bash
## (the shell used by this entrypoint).
##
## @param BUILD_DIR
##     The directory which currently contains the guacamole-client source and
##     in which the build should be performed.
##
## @param DESTINATION
##     The directory to save guacamole.war within, along with all extension
##     .jars.  Note that this script will create extension-specific
##     subdirectories within this directory, and files will thus be grouped by
##     extension type.
##

##
## The directory which currently contains the guacamole-client source and in
## which the build should be performed.
##
BUILD_DIR="$1"

##
## The directory to save guacamole.war within, along with all extension .jars.
## Note that this script will create extension-specific subdirectories within
## this directory, and files will thus be grouped by extension type.
##
DESTINATION="$2"

# Run all scripts within the "build.d" directory
for SCRIPT in /opt/guacamole/build.d/*.sh; do
    source "$SCRIPT"
done

