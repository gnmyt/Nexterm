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

import com.google.common.io.BaseEncoding;
import java.io.UnsupportedEncodingException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Provides a SHA-256 based implementation of the password encryption
 * functionality.
 */
public class SHA256PasswordEncryptionService implements PasswordEncryptionService {

    @Override
    public byte[] createPasswordHash(String password, byte[] salt) {

        try {

            // Build salted password, if a salt was provided
            StringBuilder builder = new StringBuilder();
            builder.append(password);

            if (salt != null)
                builder.append(BaseEncoding.base16().encode(salt));

            // Hash UTF-8 bytes of possibly-salted password
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(builder.toString().getBytes("UTF-8"));
            return md.digest();

        }

        // Throw hard errors if standard pieces of Java are missing
        catch (UnsupportedEncodingException e) {
            throw new UnsupportedOperationException("Unexpected lack of UTF-8 support.", e);
        }
        catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("Unexpected lack of SHA-256 support.", e);
        }

    }

}
