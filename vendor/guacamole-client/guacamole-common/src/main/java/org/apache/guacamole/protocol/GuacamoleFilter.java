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

package org.apache.guacamole.protocol;

import org.apache.guacamole.GuacamoleException;

/**
 * Interface which provides for the filtering of individual instructions. Each
 * filtered instruction may be allowed through untouched, modified, replaced,
 * dropped, or explicitly denied.
 */
public interface GuacamoleFilter {

    /**
     * Applies the filter to the given instruction, returning the original
     * instruction, a modified version of the original, or null, depending
     * on the implementation.
     *
     * @param instruction The instruction to filter.
     * @return The original instruction, if the instruction is to be allowed,
     *         a modified version of the instruction, if the instruction is
     *         to be overridden, or null, if the instruction is to be dropped.
     * @throws GuacamoleException If an error occurs filtering the instruction,
     *                            or if the instruction must be explicitly
     *                            denied.
     */
    public GuacamoleInstruction filter(GuacamoleInstruction instruction) throws GuacamoleException;
    
}
