#!/bin/bash

GUACD_LOG_LEVEL=${LOG_LEVEL:-system}

case "$GUACD_LOG_LEVEL" in
    error)
        GUACD_ARGS="-L error"
        ;;
    warn)
        GUACD_ARGS="-L warning"
        ;;
    system|info)
        GUACD_ARGS="-L info"
        ;;
    verbose)
        GUACD_ARGS="-L debug"
        ;;
    debug)
        GUACD_ARGS="-L trace"
        ;;
    *)
        GUACD_ARGS="-L info"
        ;;
esac

mkdir -p /app/data/rdp-drives

guacd -b 0.0.0.0 -l 4822 $GUACD_ARGS -f &
exec node server/index.js
