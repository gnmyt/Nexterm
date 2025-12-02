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

#ifndef _GUACD_CONF_FILE_H
#define _GUACD_CONF_FILE_H

#include "config.h"

#include "conf.h"

/**
 * Reads the given file descriptor, parsing its contents into the guacd_config.
 * On success, zero is returned. If parsing fails, non-zero is returned, and an
 * error message is printed to stderr.
 */
int guacd_conf_parse_file(guacd_config* conf, int fd);

/**
 * Loads the configuration from any of several default locations, if found. If
 * parsing fails, NULL is returned, and an error message is printed to stderr.
 */
guacd_config* guacd_conf_load();

#endif

