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
# guacctl
# -------
#
# Utility for sending Guacamole-specific console codes for controlling a
# terminal session, such as:
#
#     * Downloading files (SSH only)
#     * Setting the destination directory for uploads (SSH only)
#     * Redirecting output to a named pipe stream (SSH or telnet)
#
# This script may also be run as "guacget", in which case the script accepts
# no options and assumes anything given on the commandline is a file to be
# downloaded.
#

##
## Given the name of a file, which may be a relative path, produce the full,
## real, non-relative path for that same file.
##
## @param FILENAME
##     The name of the file to produce the full path of.
##
fullpath() {
    FILENAME="$1"
    DIR=`dirname "$FILENAME"`
    FILE=`basename "$FILENAME"`
    (cd "$DIR" && echo "$PWD/$FILE")
}

##
## Sends the Guacamole-specific console code for initiating a download.
##
## @param FILENAME
##     The full path of the file to download.
##
send_download_file() {
    FILENAME="$1"
    printf "\033]482200;%s\007" "$FILENAME"
}

##
## Sends the Guacamole-specific console code for setting the upload directory.
##
## @param FILENAME
##     The full path to the directory which should receive uploads.
##
send_set_directory() {
    FILENAME="$1"
    printf "\033]482201;%s\007" "$FILENAME"
}

##
## Sends the Guacamole-specific console code for redirecting output to a named
## pipe stream (instead of the terminal emulator)
##
## @param NAME
##     The name of the pipe stream to open.
##
send_open_pipe_stream() {
    NAME="$1"
    printf "\033]482202;%s\007" "$NAME"
}

##
## Sends the Guacamole-specific console code for redirecting output back to the
## terminal emulator
##
send_close_pipe_stream() {
    printf "\033]482203;\007"
}

##
## Sends the Guacamole-specific console code for resizing the scrollback
## buffer.
##
## @param ROWS
##     The number of rows that the scrollback buffer should contain.
##
send_resize_scrollback() {
    ROWS="$1"
    printf "\033]482204;%s\007" "$ROWS"
}

##
## Prints the given error text to STDERR.
##
## @param ...
##     The text to print as an error message.
##
error() {
    echo "$NAME:" "$@" >&2
}

##
## Prints usage documentation for this script.
##
usage() {
    cat >&2 <<END
guacctl 1.6.0, Apache Guacamole terminal session control utility.
Usage: guacctl [OPTION] [FILE or NAME]...

    -d, --download         download each of the files listed.
    -s, --set-directory    set the destination directory for future uploaded 
                           files.
    -o, --open-pipe        redirect output to a new pipe stream with the given
                           name.
    -c, --close-pipe       close any existing pipe stream and redirect output
                           back to the terminal emulator.
    -S, --scrollback       request that the scrollback buffer be limited to the
                           given number of rows.
END
}

##
## Initiates a download for each of the specified files.
##
## @param ...
##     The name of each file that should be downloaded, as originally
##     provided to guacctl.
##
download_files() {

    #
    # Validate arguments
    #

    if [ $# -lt 1 ]; then
        error "No files specified."
        return;
    fi

    #
    # Send download code for each file given
    #

    for FILENAME in "$@"; do
        if [ -e "$FILENAME" ]; then
            send_download_file "`fullpath "$FILENAME"`"
        else
            error "$FILENAME: File does not exist."
        fi
    done

}

##
## Changes the upload path for future uploads to the given directory.
##
## @param ...
##     The name of the directory to use for uploads, as provided to guacctl.
##
set_directory() {

    #
    # Validate arguments
    #

    if [ $# -lt 1 ]; then
        error "No destination directory specified."
        return;
    fi

    if [ $# -gt 1 ]; then
        error "Only one destination directory may be given."
        return;
    fi

    #
    # Send code for setting the upload directory
    #

    FILENAME="$1"
    if [ -d "$FILENAME" ]; then
        send_set_directory "`fullpath "$FILENAME"`"
    else
        error "$FILENAME: File does not exist or is not a directory."
    fi

}

##
## Opens a new pipe stream having the given name and redirects terminal output
## to that stream.
##
## @param ...
##     The name of the pipe stream to open, as provided to guacctl.
##
open_pipe_stream() {

    #
    # Validate arguments
    #

    if [ $# -lt 1 ]; then
        error "No pipe name specified."
        return;
    fi

    if [ $# -gt 1 ]; then
        error "Only one pipe name may be given."
        return;
    fi

    #
    # Send code for opening the named pipe stream
    #

    NAME="$1"
    send_open_pipe_stream "$NAME"

}

##
## Closes the currently-open pipe stream and redirects terminal output back to
## the terminal emulator
##
## @param ...
##     The arguments provided to guacctl, which should be empty.
##
close_pipe_stream() {

    #
    # Validate arguments
    #

    if [ $# -gt 0 ]; then
        error "Closing an open pipe stream does not require any arguments."
        return;
    fi

    #
    # Send code for closing the currently-open named pipe stream
    #

    send_close_pipe_stream

}

##
## Resizes the scrollback buffer to the given number of rows.
##
## @param ...
##     The number of rows that should be contained within the scrollback
##     buffer, as provided to guacctl.
##
resize_scrollback() {

    #
    # Validate arguments
    #

    if [ $# -lt 1 ]; then
        error "No row count specified."
        return;
    fi

    if [ $# -gt 1 ]; then
        error "Only one row count may be given."
        return;
    fi

    #
    # Send code for resizing scrollback
    #

    ROWS="$1"
    send_resize_scrollback "$ROWS"

}

#
# Get script name
#

NAME=`basename "$0"`

#
# Handle downloads directly if invoked as "guacget"
#

if [ "x$NAME" = "xguacget" ]; then
    download_files "$@"
    exit 0;
fi

#
# Parse options
#

case "$1" in

    #
    # Download files
    #

    "--download"|"-d")
        shift
        download_files "$@"
        ;;

    #
    # Set upload directory
    #

    "--set-directory"|"-s")
        shift
        set_directory "$@"
        ;;

    #
    # Redirect to pipe
    #

    "--open-pipe"|"-o")
        shift
        open_pipe_stream "$@"
        ;;

    #
    # Redirect back to terminal
    #

    "--close-pipe"|"-c")
        shift
        close_pipe_stream "$@"
        ;;

    #
    # Resize scrollback
    #

    "--scrollback"|"-S")
        shift
        resize_scrollback "$@"
        ;;

    #
    # Show usage info if options are invalid
    #

    *)
        usage
        exit 1
        ;;
esac

