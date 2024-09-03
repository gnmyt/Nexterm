#!/bin/bash

guacd -b 0.0.0.0 -l 4822 -f > /dev/null 2>&1 &
exec node server/index.js
