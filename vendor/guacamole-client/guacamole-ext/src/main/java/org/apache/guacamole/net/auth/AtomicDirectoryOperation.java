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

package org.apache.guacamole.net.auth;

import org.apache.guacamole.GuacamoleException;

/**
 * An operation that should be attempted atomically when passed to
 * {@link Directory#tryAtomically}, if atomic operations are supported by
 * the Directory.
 */
public interface AtomicDirectoryOperation<ObjectType extends Identifiable>  {

    /**
     * Attempt the operation atomically. If the Directory does not support
     * atomic operations, the atomic flag will be set to false. If the atomic
     * flag is set to true, the provided directory is guaranteed to perform
     * the operations within this function atomically. Atomicity of the
     * provided directory outside this function, or of the directory invoking
     * this function are not guaranteed.
     *
     * <p>NOTE: If atomicity is required for this operation, a 
     * GuacamoleException may be thrown by this function before any changes are
     * made, ensuring the operation will only ever be performed atomically.
     *
     * @param atomic
     *     True if the provided directory is guaranteed to perform the operation
     *     atomically within the context of this function.
     *
     * @param directory
     *     A directory that will perform the operation atomically if the atomic
     *     flag is set to true. If the flag is false, the directory may still
     *     be used, though atomicity is not guaranteed.
     *
     * @throws GuacamoleException
     *     If an issue occurs during the operation.
     */
    void executeOperation(boolean atomic, Directory<ObjectType> directory)
            throws GuacamoleException;
}
