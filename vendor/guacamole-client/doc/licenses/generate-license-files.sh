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
# NOTE: Parts of this file (Makefile.am) are automatically transcluded verbatim
# into Makefile.in. Though the build system (GNU Autotools) automatically adds
# its own license boilerplate to the generated Makefile.in, that boilerplate
# does not apply to the transcluded portions of Makefile.am which are licensed
# to you by the ASF under the Apache License, Version 2.0, as described above.
#

#
# generate-license-files.sh
# -------------------------
#
# Automatically iterates through the provided runtime dependencies of the
# project in the current directory, creating new LICENSE and NOTICE files which
# contain all the license information of bundled dependencies, as well as any
# required notices.
#
# This script is expected to be invoked as part of the build process of the
# various guacamole-client subprojects.
#
# USAGE:
#
#     path/to/generate-license-files.sh DEPENDENCY_LIST OUTPUT_DIRECTORY
#
# where DEPENDENCY_LIST is the list of dependencies to consider when generating
# LICENSE and NOTICE (as produced by "mvn dependency:list" or our
# DependencyListPlugin for Webpack) and OUTPUT_DIRECTORY is the directory in
# which the LICENSE and NOTICE files should be written.
#
# If DEPENDENCY_LIST is a directory, all normal files within the directory will
# be concatenated to produce the list.
#
# Ignoring license errors
# -----------------------
#
# By default, this script will exit with a non-zero exit code if any license
# errors are encountered, failing the build. If this is undesirable (dependency
# changes are being tested, a full list of all license errors across all
# projects is needed, etc.), set the IGNORE_LICENSE_ERRORS environment variable
# to "true".
#
# Structure of license information
# --------------------------------
#
# The LICENSE and NOTICE files of the guacamole-client project are used as the
# basis for the generated LICENSE and NOTICE files. It is expected that the
# guacamole-client LICENSE will may contain license information for
# subcomponents that had to be copied verbatim into the source tree, with that
# information following a human-readable preamble that begins with a solid line
# of "=" characters. This line of "=" characters MUST BE INCLUDED when such
# dependencies are present, as it is specifically searched for by this script
# when determining what parts of the main LICENSE file should be copied over.
#
# License information for the bundled runtime dependencies of all subprojects
# is included in the subdirectories of the "doc/licenses/" directory of the
# main guacamole-client source tree. Each subdirectory is associated with a
# single, logical dependency, with the coordinates of that dependency listed in
# the "dep-coordinates.txt" file within that subdirectory. There may be
# multiple coordinates associated with a dependency, in which case each
# relevant set of coordinates should be listed on its own line.
#
# For dependencies that are not associated with coordinates that can be
# automatically deteremined, the licenses of those dependencies should instead
# be documented within subdirectories of the "src/licenses/bundled/" directory
# of the relevant subproject.
#
# Regardless of whether a dependency is documented within the top-level
# guacamole-client project or within the relevant subproject, the subdirectory
# for each dependency must contain a "README" file describing the dependency,
# the version used, the copyright holder(s), and the license. Examples of the
# formatting expected for these README files can be found within the existing
# dependency license directories.
#
# Files that contain the word "notice", regardless of case, are considered by
# this script to be the notice file mentioned within the Apache License, and
# will be copied verbatim into the generated NOTICE file.
#
# Files that that are not recognized as any other type of file are considered
# by this script to be the license and will be included verbatim within the
# generated LICENSE if they are less than 50 lines.
#

##
## The filename of the file containing whether any errors have been logged. The
## contents of this file will be set to "1" if at least one error occurred. A
## file is used here instead of a simple environment variable to allow error()
## to be called from within pipelines and still be detectable.
##
HAS_ERRORS="`mktemp`"
trap 'rm -f "$HAS_ERRORS"' EXIT

##
## The maximum size of a license that may be included verbatim within the
## generated LICENSE file. Larger licenses will only be included separately.
##
LICENSE_COPY_LIMIT=50

##
## The directory containing this script and all license information. This
## should be "doc/licenses/" within the guacamole-client source tree.
##
LICENSES_DIR="`dirname "$0"`"

##
## The base directory of the guacamole-client source tree.
##
BASEDIR="$LICENSES_DIR/../.."

##
## The file containing all relevant runtime dependencies, as generated by
## "mvn dependency:list".
##
DEPENDENCY_LIST="$1"

##
## The output directory in which the generated LICENSE, NOTICE, etc. files
## should be placed.
##
OUTPUT_DIR="$2"

##
## Lists the license information directories (subdirectories of the
## "doc/licenses/" directory in the main guacamole-client source tree) that
## apply to the list of runtime dependencies provided via STDIN. If any runtime
## dependencies are not described by license information included in the
## guacamole-client source tree, a error is printed to STDERR.
##
## The license information directories for dependencies that are not pulled in
## automatically (subdirectories of the "src/licenses/bundled/" directory
## within the current project) will also be included, if any.
##
list_dependency_license_info() {

    # List the license directories of all runtime dependencies, as dictated by
    # the "dep-coordinates.txt" files included within those directories
    sed 's/^[[:space:]]\+//' | grep -o '^[^: ]\+\(:[^: ]*\)\{1,3\}' | while read DEPENDENCY; do

        if ! grep -l "$DEPENDENCY[[:space:]]*$" "$LICENSES_DIR"/*/dep-coordinates.txt; then
            error "License information missing for $DEPENDENCY"
        fi

    done | sort -u | while read LICENSE_INFO_COORDS_FILE; do
        dirname "$LICENSE_INFO_COORDS_FILE"
    done

    # Include license directories for all dependencies not pulled in automatically
    if [ -d ./src/licenses/bundled/ ]; then
        find src/licenses/bundled/ -mindepth 1 -maxdepth 1 -type d
    fi

}

##
## Sorts the given list of license information directories by the name of the
## dependency, as determined by the header line within that dependency's
## README. The list of directories is read from STDIN, and the sorted result is
## written to STDOUT. Each directory must be on its own line.
##
sort_dependency_license_info() {
    while read LICENSE_INFO; do

        if [ ! -e "$LICENSE_INFO/README" ]; then
            error "Missing license README in $LICENSE_INFO"
            continue
        fi

        NAME="`grep . < "$LICENSE_INFO/README" | head -n1`"
        printf "%s\t%s\n" "$NAME" "$LICENSE_INFO"

    done | sort -f | cut -f2
}

##
## Prints the given informational message to STDERR.
##
## @param ...
##     The message to print.
##
info() {
    echo "$@" >&2
}

##
## Prints the given error message to STDERR, updating HAS_ERRORS
## appropriately.
##
## @param ...
##     The message to print.
##
error() {
    echo "ERROR: $@" >&2
    echo "1" > "$HAS_ERRORS"
}

##
## Prints the first line from STDIN. If more than one line is provided,
## those lines are omitted, and an error exit code is returned.
##
## @return
##     Zero (success) if no more than one line was provided on STDIN,
##     non-zero (failure) otherwise.
##
single_result() {
    read RESULT && echo "$RESULT"
    ! read DUMMY
}

##
## Searches the given directory for a license file, prints the path to the
## license file found. If multiple files are found, only the first file is
## printed, and an error is logged to STDERR.
##
## @param DIR
##     The directory to search.
##
license_file() {
    DIR="$1"
    find "$DIR" -mindepth 1 \
            -a \! -iname "*notice*" \
            -a \! -name "dep-coordinates.txt" \
            -a \! -name "README" \
        | if ! single_result; then
           error "Multiple license files found within $DIR"
        fi 
}

##
## Searches the given directory for a notice file, prints the path to the
## notice file found. If multiple files are found, only the first file is
## printed, and a error is logged to STDERR.
##
## @param DIR
##     The directory to search.
##
notice_file() {
    DIR="$1"
    find "$DIR" -iname "*notice*" \
        | if ! single_result; then
           error "Multiple notice files found within $DIR"
        fi 
}

##
## Prints the contents of the given file, excluding any blank lines at the
## beginning and end of the file.
##
## @param FILENAME
##     The file to print.
##
trim_file() {

    FILENAME="$1"

    # Find line number of first and last non-blank lines
    FIRST_LINE="`awk '/[^\t ]/ {print NR; exit}' "$FILENAME"`"
    LAST_LINE="`awk '/[^\t ]/ {last=NR} END {print last}' "$FILENAME"`"

    # Print the contents of the file between those lines, inclusive
    awk "NR==$FIRST_LINE,NR==$LAST_LINE" "$FILENAME"

}

# Verify that an output directory was provided
if [ -z "$DEPENDENCY_LIST" -o -z "$OUTPUT_DIR" ]; then
    error "USAGE: $0 DEPENDENCY_LIST OUTPUT_DIRECTORY"
    exit 1
fi

# Verify input file actually exists
if [ ! -r "$DEPENDENCY_LIST" ]; then
    error "$DEPENDENCY_LIST cannot be read."
    exit 1
fi

#
# Autogenerate base LICENSE and NOTICE
#

info "Processing runtime dependencies to produce LICENSE and NOTICE. Output will be within \"$OUTPUT_DIR\"."
mkdir -p "$OUTPUT_DIR"

# Copy overall license up to but not including its subcomponent preamble (the
# section that starts after a line made up entirely of "=" characters)
awk 'NR==1 {flag=1}; /^[=]{10,}$/ {flag=0}; flag;' "$BASEDIR/LICENSE" > "$OUTPUT_DIR/LICENSE"

# Copy base NOTICE verbatim
cp "$BASEDIR/NOTICE" "$OUTPUT_DIR/"

#
# Autogenerate LICENSE and NOTICE information from dependencies
#

PREAMBLE_ADDED=0
find "$DEPENDENCY_LIST" -type f -exec cat '{}' + | \
    list_dependency_license_info | sort_dependency_license_info | \
    while read LICENSE_INFO_DIR; do

    # Add subcomponent license preamble if not already added
    if [ "$PREAMBLE_ADDED" = 0 ]; then
        cat >> "$OUTPUT_DIR/LICENSE" <<EOF
==============================================================================

APACHE GUACAMOLE SUBCOMPONENTS

Apache Guacamole includes a number of subcomponents with separate copyright
notices and license terms. Your use of these subcomponents is subject to the
terms and conditions of the following licenses.
EOF
        PREAMBLE_ADDED=1
    fi

    # Locate LICENSE and NOTICE files
    LICENSE_FILE="`license_file "$LICENSE_INFO_DIR"`"
    NOTICE_FILE="`notice_file "$LICENSE_INFO_DIR"`"

    # Extract component name from README
    COMPONENT_NAME="`trim_file "$LICENSE_INFO_DIR/README" | head -n1 | grep -o '^[^(]*[^([:space:]]'`"

    # Add license information to LICENSE
    printf '\n\n' >> "$OUTPUT_DIR/LICENSE"
    trim_file "$LICENSE_INFO_DIR/README" >> "$OUTPUT_DIR/LICENSE"

    # Append verbatim copy of license if small enough
    if [ -n "$LICENSE_FILE" ]; then
        if [ "`wc -l < "$LICENSE_FILE"`" -le "$LICENSE_COPY_LIMIT" ]; then
            echo >> "$OUTPUT_DIR/LICENSE"
            trim_file "$LICENSE_FILE" >> "$OUTPUT_DIR/LICENSE"
        fi
    fi

    # Copy NOTICE, if provided
    if [ -n "$NOTICE_FILE" ]; then
        printf '\n======== NOTICE for "%s" ========\n\n' "$COMPONENT_NAME" >> "$OUTPUT_DIR/NOTICE"
        trim_file "$NOTICE_FILE" >> "$OUTPUT_DIR/NOTICE"
    fi

    # Include verbatim copy of license information
    mkdir -p "$OUTPUT_DIR/bundled/"
    cp -Lr "$LICENSE_INFO_DIR" "$OUTPUT_DIR/bundled/"

    # Add README describing nature of the "bundled/" directory
    cat > "$OUTPUT_DIR/bundled/README" <<EOF
Apache Guacamole includes a number of subcomponents with separate copyright
notices and license terms. Your use of these subcomponents is subject to the
terms and conditions of their respective licenses, included within this
directory for reference.
EOF

done

# Do not double-bundle the information contained in the README files (it's
# already in LICENSE), nor internal mappings like dep-coordinates.txt
for EXCLUDED_FILE in README dep-coordinates.txt; do
    rm -f "$OUTPUT_DIR/bundled"/*/"$EXCLUDED_FILE"
done

# Fail if any errors occured unless explicitly configured to ignore errors with
# the IGNORE_LICENSE_ERRORS environment variable
if [ "`cat "$HAS_ERRORS"`" = "1" ]; then
    [ "$IGNORE_LICENSE_ERRORS" = "true" ] || exit 1
    info "Ignoring above license errors (IGNORE_LICENSE_ERRORS was set to \"$IGNORE_LICENSE_ERRORS\")."
else
    info "Dependency licenses processed successfully."
fi

