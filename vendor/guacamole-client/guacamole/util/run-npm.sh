#!/bin/sh
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
# run-npm.sh - Convenience script for automatically running the version of NPM
# used by the "guacamole" build. All command-line options given to this script
# are passed directly to NPM. The Guacamole build must have run at least once,
# even unsuccessfully, for copies of Node.js and NPM to have been downloaded.
#

##
## The directory containing this script.
##
UTIL_DIR="`dirname "$0"`"

##
## The directory containing the "guacamole" project.
##
PROJECT_DIR="$UTIL_DIR/.."

##
## The directory containing copies of Node.js and NPM that were downloaded by
## the "guacamole" project build process.
##
NODE_DIR="$PROJECT_DIR/target/node"

# Invoke NPM with provided arguments, using the Node.js and NPM versions
# downloaded by the "guacamole" project build
exec "$NODE_DIR/node" "$NODE_DIR/node_modules/npm/bin/npm-cli.js" "$@"

