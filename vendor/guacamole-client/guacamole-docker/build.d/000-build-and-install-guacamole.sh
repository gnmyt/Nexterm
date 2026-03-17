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
## @fn 000-build-and-install-guacamole.sh
##
## Builds the Guacamole web application and all main extensions, installing the
## resulting binaries to standard locations within the Docker image. After the
## build and install process, the resulting binaries can be found beneath:
##
## /opt/guacamole/webapp:
##   The web application, "guacamole.war".
##
## /opt/guacamole/extensions:
##   All extensions, each within their own subdirectory and identical to the
##   result of extracting a released .tar.gz except that version numbers of been
##   stripped.
##

#
# Build guacamole.war and all extensions, applying any provided Maven build
# arguments
#

cd "$BUILD_DIR"
mvn $MAVEN_ARGUMENTS package

#
# Copy built web application (guacamole.war) to destination location
#

mkdir -p "$DESTINATION/webapp"
cp guacamole/target/*.war "$DESTINATION/webapp/guacamole.war"

#
# Extract all extensions to destination location, stripping version number
# suffix from .jar files and top-level directory name
#

mkdir -p "$DESTINATION/extensions"
find extensions/ -path "**/target/*.tar.gz" -exec tar -xzf "{}" \
    -C "$DESTINATION/extensions"                                \
    --xform='s#^\([^/]*\)-[0-9]\+\.[0-9]\+\.[0-9]\+#\1#g'       \
    --xform='s#-[0-9]\+\.[0-9]\+\.[0-9]\+\(\.jar$\)#\1#g'       \
    ";"

