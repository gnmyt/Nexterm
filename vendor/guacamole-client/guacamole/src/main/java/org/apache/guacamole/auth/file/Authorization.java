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

package org.apache.guacamole.auth.file;

import java.io.UnsupportedEncodingException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Mapping of username/password pair to configuration set. In addition to basic
 * storage of the username, password, and configurations, this class also
 * provides password validation functions.
 */
public class Authorization {

    /**
     * All supported password encodings.
     */
    public static enum Encoding {

        /**
         * Plain-text password (not hashed at all).
         */
        PLAIN_TEXT,

        /**
         * Password hashed with MD5.
         */
        MD5,
        
        /**
         * Passwords hashed with SHA256.
         */
        SHA_256

    }

    /**
     * The username being authorized.
     */
    private String username;

    /**
     * The password corresponding to the username being authorized, which may
     * be hashed.
     */
    private String password;

    /**
     * The encoding used when the password was hashed.
     */
    private Encoding encoding = Encoding.PLAIN_TEXT;

    /**
     * Map of all authorized configurations, indexed by configuration name.
     */
    private Map<String, GuacamoleConfiguration> configs = new
            TreeMap<String, GuacamoleConfiguration>();

    /**
     * Lookup table of hex bytes characters by value.
     */
    private static final char HEX_CHARS[] = {
        '0', '1', '2', '3', '4', '5', '6', '7',
        '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'
    };

    /**
     * Produces a String containing the bytes provided in hexadecimal notation.
     *
     * @param bytes The bytes to convert into hex.
     * @return A String containing the hex representation of the given bytes.
     */
    private static String getHexString(byte[] bytes) {

        // If null byte array given, return null
        if (bytes == null)
            return null;

        // Create string builder for holding the hex representation,
        // pre-calculating the exact length
        StringBuilder hex = new StringBuilder(2 * bytes.length);

        // Convert each byte into a pair of hex digits
        for (byte b : bytes) {
            hex.append(HEX_CHARS[(b & 0xF0) >> 4])
               .append(HEX_CHARS[ b & 0x0F      ]);
        }

        // Return the string produced
        return hex.toString();

    }

    /**
     * Returns the username associated with this authorization.
     *
     * @return The username associated with this authorization.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the username associated with this authorization.
     *
     * @param username The username to associate with this authorization.
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the password associated with this authorization, which may be
     * encoded or hashed.
     *
     * @return The password associated with this authorization.
     */
    public String getPassword() {
        return password;
    }

    /**
     * Sets the password associated with this authorization, which must be
     * encoded using the encoding specified with setEncoding(). By default,
     * passwords are plain text.
     *
     * @param password Sets the password associated with this authorization.
     */
    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * Returns the encoding used to hash the password, if any.
     *
     * @return The encoding used to hash the password.
     */
    public Encoding getEncoding() {
        return encoding;
    }

    /**
     * Sets the encoding which will be used to hash the password or when
     * comparing a given password for validation.
     *
     * @param encoding The encoding to use for password hashing.
     */
    public void setEncoding(Encoding encoding) {
        this.encoding = encoding;
    }

    /**
     * Returns whether a given username/password pair is authorized based on
     * the stored username and password. The password given must be plain text.
     * It will be hashed as necessary to perform the validation.
     *
     * @param username The username to validate.
     * @param password The password to validate.
     * @return true if the username/password pair given is authorized, false
     *         otherwise.
     */
    public boolean validate(String username, String password) {

        // If username matches
        if (username != null && password != null
                && username.equals(this.username)) {

            switch (encoding) {

                // If plain text, just compare
                case PLAIN_TEXT:

                    // Compare plaintext
                    return password.equals(this.password);

                // If hased with MD5, hash password and compare
                case MD5:

                    // Compare hashed password
                    try {
                        MessageDigest digest = MessageDigest.getInstance("MD5");
                        String hashedPassword = getHexString(digest.digest(password.getBytes("UTF-8")));
                        return hashedPassword.equals(this.password.toUpperCase());
                    }
                    catch (UnsupportedEncodingException e) {
                        throw new UnsupportedOperationException("Unexpected lack of UTF-8 support.", e);
                    }
                    catch (NoSuchAlgorithmException e) {
                        throw new UnsupportedOperationException("Unexpected lack of MD5 support.", e);
                    }

                case SHA_256:

                    try {
                        MessageDigest digest = MessageDigest.getInstance("SHA-256");
                        String hashedPassword = getHexString(digest.digest(password.getBytes("UTF-8")));
                        return hashedPassword.equals(this.password.toUpperCase());
                    }
                    catch (UnsupportedEncodingException e) {
                        throw new UnsupportedOperationException("Unexpected lack of UTF-8 support.", e);
                    }
                    catch (NoSuchAlgorithmException e) {
                        throw new UnsupportedOperationException("Unexpected lack of SHA-256 support.", e);
                    }
            }

        } // end validation check

        return false;

    }

    /**
     * Returns the GuacamoleConfiguration having the given name and associated
     * with the username/password pair stored within this authorization.
     *
     * @param name The name of the GuacamoleConfiguration to return.
     * @return The GuacamoleConfiguration having the given name, or null if no
     *         such GuacamoleConfiguration exists.
     */
    public GuacamoleConfiguration getConfiguration(String name) {
        return configs.get(name);
    }

    /**
     * Adds the given GuacamoleConfiguration to the set of stored configurations
     * under the given name.
     *
     * @param name The name to associate this GuacamoleConfiguration with.
     * @param config The GuacamoleConfiguration to store.
     */
    public void addConfiguration(String name, GuacamoleConfiguration config) {
        configs.put(name, config);
    }

    /**
     * Returns a Map of all stored GuacamoleConfigurations associated with the
     * username/password pair stored within this authorization, indexed by
     * configuration name.
     *
     * @return A Map of all stored GuacamoleConfigurations.
     */
    public Map<String, GuacamoleConfiguration> getConfigurations() {
        return configs;
    }

}
