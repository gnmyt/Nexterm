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

package org.apache.guacamole.rest.auth;

import com.google.common.io.BaseEncoding;
import java.security.SecureRandom;

/**
 * An implementation of the AuthTokenGenerator based around SecureRandom.
 */
public class SecureRandomAuthTokenGenerator implements AuthTokenGenerator {

    /**
     * Instance of SecureRandom for generating the auth token.
     */
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public String getToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        
        return BaseEncoding.base16().encode(bytes);
    }
    
}
