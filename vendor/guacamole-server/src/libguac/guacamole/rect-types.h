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

#ifndef GUAC_RECT_TYPES_H
#define GUAC_RECT_TYPES_H

/**
 * A rectangle defined by its upper-left and lower-right corners. The
 * upper-left corner is inclusive (represents the start of the area contained
 * by the guac_rect), while the lower-right corner is exclusive (represents the
 * start of the area NOT contained by the guac_rect). All coordinates may be
 * negative.
 */
typedef struct guac_rect guac_rect;

#endif

