/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#ifndef GUAC_SSH_PIPE_H
#define GUAC_SSH_PIPE_H

#include "config.h"

#include <guacamole/user.h>

/**
 * The name reserved for the inbound pipe stream which forces the terminal
 * emulator's STDIN to be received from the pipe.
 */
#define GUAC_SSH_STDIN_PIPE_NAME "STDIN"

/**
 * Handles an incoming stream from a Guacamole "pipe" instruction. If the pipe
 * is named "STDIN", the contents of the pipe stream are redirected to
 * STDIN of the terminal emulator for as long as the pipe is open.
 */
guac_user_pipe_handler guac_ssh_pipe_handler;

#endif

