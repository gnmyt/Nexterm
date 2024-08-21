#!/bin/bash

guacd -b 0.0.0.0 -l 4822 -f &
exec node server/index.js
