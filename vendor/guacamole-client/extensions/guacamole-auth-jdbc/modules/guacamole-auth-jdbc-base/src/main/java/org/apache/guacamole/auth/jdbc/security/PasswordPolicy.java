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

import org.apache.guacamole.GuacamoleException;

/**
 * A set of restrictions which define the level of complexity required for
 * the passwords of Guacamole user accounts.
 */
public interface PasswordPolicy {

    /**
     * Returns the minimum length of new passwords, in characters. Passwords
     * which are shorter than this length cannot be used.
     *
     * @return
     *     The minimum number of characters required for new passwords.
     *
     * @throws GuacamoleException
     *     If the minimum password length cannot be parsed from
     *     guacamole.properties.
     */
    int getMinimumLength() throws GuacamoleException;

    /**
     * Returns the minimum number of days which must elapse before the user's
     * password may be reset. If this restriction does not apply, this will be
     * zero.
     *
     * @return
     *     The minimum number of days which must elapse before the user's
     *     password may be reset, or zero if this restriction does not apply.
     *
     * @throws GuacamoleException
     *     If the minimum password age cannot be parsed from
     *     guacamole.properties.
     */
    int getMinimumAge() throws GuacamoleException;

    /**
     * Returns the maximum number of days which may elapse before the user's
     * password must be reset. If this restriction does not apply, this will be
     * zero.
     *
     * @return
     *     The maximum number of days which may elapse before the user's
     *     password must be reset, or zero if this restriction does not apply.
     *
     * @throws GuacamoleException
     *     If the maximum password age cannot be parsed from
     *     guacamole.properties.
     */
    int getMaximumAge() throws GuacamoleException;

    /**
     * Returns the number of previous passwords remembered for each user. If
     * greater than zero, users will be prohibited from reusing those passwords.
     *
     *
     * @return
     *     The number of previous passwords remembered for each user.
     *
     * @throws GuacamoleException
     *     If the password history size cannot be parsed from
     *     guacamole.properties.
     */
    int getHistorySize() throws GuacamoleException;

    /**
     * Returns whether both uppercase and lowercase characters must be present
     * in new passwords. If true, passwords which do not have at least one
     * uppercase letter and one lowercase letter cannot be used.
     *
     * @return
     *     true if both uppercase and lowercase characters must be present in
     *     new passwords, false otherwise.
     *
     * @throws GuacamoleException
     *     If the multiple case requirement cannot be parsed from
     *     guacamole.properties.
     */
    boolean isMultipleCaseRequired() throws GuacamoleException;

    /**
     * Returns whether numeric characters (digits) must be present in new
     * passwords. If true, passwords which do not have at least one numeric
     * character cannot be used.
     *
     * @return
     *     true if numeric characters must be present in new passwords,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If the numeric character requirement cannot be parsed from
     *     guacamole.properties.
     */
    boolean isNumericRequired() throws GuacamoleException;

    /**
     * Returns whether non-alphanumeric characters (symbols) must be present in
     * new passwords. If true, passwords which do not have at least one
     * non-alphanumeric character cannot be used.
     *
     * @return
     *     true if non-alphanumeric characters must be present in new passwords,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If the non-alphanumeric character requirement cannot be parsed from
     *     guacamole.properties.
     */
    boolean isNonAlphanumericRequired() throws GuacamoleException;

    /**
     * Returns whether new passwords must not contain the user's own username.
     *
     * @return
     *     true if new passwords must not contain the user's own username,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If the username password restriction cannot be parsed from
     *     guacamole.properties.
     */
    boolean isUsernameProhibited() throws GuacamoleException;

}
