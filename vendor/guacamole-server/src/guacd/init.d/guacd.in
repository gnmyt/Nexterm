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

# guacd
#
# chkconfig:   2345 20 80
# description: Guacamole proxy daemon

### BEGIN INIT INFO
# Provides:          guacd
# Required-Start:    $network $syslog 
# Required-Stop:     $network $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Guacamole proxy daemon
# Description: The Guacamole proxy daemon, required to translate remote desktop protocols into the text-based Guacamole protocol used by the JavaScript application.
### END INIT INFO

prog="guacd"
exec="@sbindir@/$prog"
pidfile="/var/run/$prog.pid"

# Returns PID of currently running process, if any
getpid() {

    if [ -f "$pidfile" ]
    then

        read PID < "$pidfile"

        # If pidfile contains PID and PID is valid
        if [ -n "$PID" ] && ps "$PID" > /dev/null 2>&1
        then
            echo "$PID"
            return 0
        fi

    fi

    # pidfile/pid not found, or process is dead
    return 1

}

start() {
    [ -x $exec ] || exit 5
    echo -n "Starting $prog: "

    getpid > /dev/null || $exec -p "$pidfile" 
    retval=$?

    case "$retval" in
        0)
            echo "SUCCESS"
            ;;
        *)
            echo "FAIL"
            ;;
    esac

    return $retval
}

stop() {
    echo -n "Stopping $prog: "
    
    PID=`getpid`
    retval=$?

    case "$retval" in
        0)
            if kill $PID > /dev/null 2>&1
            then
                echo "SUCCESS"
                return 0
            fi

            echo "FAIL"
            return 1
            ;;
        *)
            echo "SUCCESS (not running)"
            return 0
            ;;
    esac

}

restart() {
    stop && start
}

force_reload() {
    restart
}

status() {
    
    PID=`getpid`
    retval=$?

    case "$retval" in
        0)
            echo "$prog is running with PID=$PID."
            ;;
        *)
            echo "$prog is not running."
            ;;
    esac

    return $retval

}

case "$1" in
    start|stop|status|restart|force-reload)
        $1
        ;;
    try-restart)
        status && restart
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|try-restart|force-reload}"
        exit 2
esac
exit $?

