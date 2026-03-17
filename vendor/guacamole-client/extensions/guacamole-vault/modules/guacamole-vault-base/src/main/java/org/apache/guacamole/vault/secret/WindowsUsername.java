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

package org.apache.guacamole.vault.secret;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.annotation.Nonnull;

/**
 * A class representing a Windows username, which may optionally also include
 * a domain. This class can be used to parse the username and domain out of a
 * username from a vault.
 */
public class WindowsUsername {

    /**
     * A pattern for matching a down-level logon name containing a Windows
     * domain and username - e.g. domain\\user. For more information, see
     * https://docs.microsoft.com/en-us/windows/win32/secauthn/user-name-formats#down-level-logon-name
     */
    private static final Pattern DOWN_LEVEL_LOGON_NAME_PATTERN = Pattern.compile(
            "(?<domain>[^@\\\\]+)\\\\(?<username>[^@\\\\]+)");

    /**
     * A pattern for matching a user principal name containing a Windows
     * domain and username - e.g. user@domain. For more information, see
     * https://docs.microsoft.com/en-us/windows/win32/secauthn/user-name-formats#user-principal-name
     */
    private static final  Pattern USER_PRINCIPAL_NAME_PATTERN = Pattern.compile(
            "(?<username>[^@\\\\]+)@(?<domain>[^@\\\\]+)");

    /**
     * The username associated with the potential Windows domain/username
     * value. If no domain is found, the username field will contain the
     * entire value as read from the vault.
     */
    private final String username;

    /**
     * The dinaun associated with the potential Windows domain/username
     * value. If no domain is found, this will be null.
     */
    private final String domain;

    /**
     * Create a WindowsUsername record with no associated domain.
     *
     * @param username
     *     The username, which should be the entire value as extracted
     *     from the vault.
     */
    private WindowsUsername(@Nonnull String username) {
        this.username = username;
        this.domain = null;
    }

    /**
     * Create a WindowsUsername record with a username and a domain.
     *
     * @param username
     *     The username portion of the field value from the vault.
     *
     * @param domain
     *     The domain portion of the field value from the vault.
     */
    private WindowsUsername(
            @Nonnull String username, @Nonnull String domain) {
        this.username = username;
        this.domain = domain;
    }

    /**
     * Return the value of the username as extracted from the vault field.
     * If the domain is null, this will be the entire field value.
     *
     * @return
     *     The username value as extracted from the vault field.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Return the value of the domain as extracted from the vault field.
     * If this is null, it means that no domain was found in the vault field.
     *
     * @return
     *     The domain value as extracted from the vault field.
     */
    public String getDomain() {
        return domain;
    }

    /**
     * Return true if a domain was found in the vault field, false otherwise.
     *
     * @return
     *     true if a domain was found in the vault field, false otherwise.
     */
    public boolean hasDomain() {
        return this.domain != null;
    }

    /**
     * Strip off a Windows domain from the provided username, if one is
     * present. For example: "DOMAIN\\user" or "user@DOMAIN" will both
     * be stripped to just "user". Note: neither the '@' or '\\' characters
     * are valid in Windows usernames.
     *
     * @param vaultField
     *     The raw field value as retrieved from the vault. This might contain
     *     a Windows domain.
     *
     * @return
     *     The provided username with the Windows domain stripped off, if one
     *     is present.
     */
    public static WindowsUsername splitWindowsUsernameFromDomain(String vaultField) {

        // If it's the down-level logon format, return the extracted username and domain
        Matcher downLevelLogonMatcher = DOWN_LEVEL_LOGON_NAME_PATTERN.matcher(vaultField);
        if (downLevelLogonMatcher.matches())
            return new WindowsUsername(
                    downLevelLogonMatcher.group("username"),
                    downLevelLogonMatcher.group("domain"));

        // If it's the user principal format, return the extracted username and domain
        Matcher userPrincipalMatcher = USER_PRINCIPAL_NAME_PATTERN.matcher(vaultField);
        if (userPrincipalMatcher.matches())
            return new WindowsUsername(
                    userPrincipalMatcher.group("username"),
                    userPrincipalMatcher.group("domain"));

        // If none of the expected formats matched, return the username with do domain
        return new WindowsUsername(vaultField);

    }

}