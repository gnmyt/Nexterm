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
## @fn 999-verify-sanity.sh
##
## Performs sanity checks on the results of the build that verify the image
## contains everything it is expected to contain, including all built
## extensions. If symbolic links were not correctly constructed, or some built
## extensions were not mapped to environment variable prefixes, this script
## will log errors and fail the build.
##

# Perform basic sanity checks that the symbolic links used to associated
# environment variables with extensions/libraries have been correctly created,
# bailing out if any problems are found.
(

    # Search for any broken symbolic links intended to map files for
    # environment variables
    find "$DESTINATION/environment/" -xtype l | sed 's/^/Broken link: /'

    # Search for extensions that have not been mapped to any environment
    # variables at all
    comm -23 \
        <(find "$DESTINATION/extensions/" -name "*.jar" -exec realpath "{}" ";" | sort -u) \
        <(find "$DESTINATION/environment/" -path "**/extensions/*.jar" -exec realpath "{}" ";" | sort -u) \
        | sed 's/^/Unmapped extension: /'

) | sed 's/^/ERROR: /' | (! grep .) >&2 || exit 1

