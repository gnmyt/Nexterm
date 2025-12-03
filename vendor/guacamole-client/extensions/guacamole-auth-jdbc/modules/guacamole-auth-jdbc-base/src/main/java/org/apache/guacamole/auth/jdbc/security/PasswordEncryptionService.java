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

package org.apache.guacamole.auth.jdbc.security;

/**
 * A service to perform password encryption and checking.
 */
public interface PasswordEncryptionService {

    /**
     * Creates a password hash based on the provided username, password, and
     * salt. If the provided salt is null, only the password itself is hashed.
     *
     * @param password
     *     The password to hash.
     *
     * @param salt
     *     The salt to use when hashing the password, if any.
     *
     * @return
     *     The generated password hash.
     */
    public byte[] createPasswordHash(String password, byte[] salt);

}
