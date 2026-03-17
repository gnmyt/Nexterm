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

package org.apache.guacamole.auth.postgresql.conf;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicy;
import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;

/**
 * PasswordPolicy implementation which reads the details of the policy from
 * PostgreSQL-specific properties in guacamole.properties.
 */
public class PostgreSQLPasswordPolicy implements PasswordPolicy {

    /**
     * The property which specifies the minimum length required of all user
     * passwords. By default, this will be zero.
     */
    private static final IntegerGuacamoleProperty MIN_LENGTH =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-min-length"; }

    };

    /**
     * The property which specifies the minimum number of days which must
     * elapse before a user may reset their password. If set to zero, the
     * default, then this restriction does not apply.
     */
    private static final IntegerGuacamoleProperty MIN_AGE =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-min-age"; }

    };

    /**
     * The property which specifies the maximum number of days which may
     * elapse before a user is required to reset their password. If set to zero,
     * the default, then this restriction does not apply.
     */
    private static final IntegerGuacamoleProperty MAX_AGE =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-max-age"; }

    };

    /**
     * The property which specifies the number of previous passwords remembered
     * for each user. If set to zero, the default, then this restriction does
     * not apply.
     */
    private static final IntegerGuacamoleProperty HISTORY_SIZE =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-history-size"; }

    };

    /**
     * The property which specifies whether all user passwords must have at
     * least one lowercase character and one uppercase character. By default,
     * no such restriction is imposed.
     */
    private static final BooleanGuacamoleProperty REQUIRE_MULTIPLE_CASE =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-require-multiple-case"; }

    };

    /**
     * The property which specifies whether all user passwords must have at
     * least one numeric character (digit). By default, no such restriction is
     * imposed.
     */
    private static final BooleanGuacamoleProperty REQUIRE_DIGIT =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-require-digit"; }

    };

    /**
     * The property which specifies whether all user passwords must have at
     * least one non-alphanumeric character (symbol). By default, no such
     * restriction is imposed.
     */
    private static final BooleanGuacamoleProperty REQUIRE_SYMBOL =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-require-symbol"; }

    };

    /**
     * The property which specifies whether users are prohibited from including
     * their own username in their password. By default, no such restriction is
     * imposed.
     */
    private static final BooleanGuacamoleProperty PROHIBIT_USERNAME =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "postgresql-user-password-prohibit-username"; }

    };

    /**
     * The Guacamole server environment.
     */
    private final JDBCEnvironment environment;

    /**
     * Creates a new PostgreSQLPasswordPolicy which reads the details of the
     * policy from the properties exposed by the given environment.
     *
     * @param environment
     *     The environment from which password policy properties should be
     *     read.
     */
    public PostgreSQLPasswordPolicy(JDBCEnvironment environment) {
        this.environment = environment;
    }

    @Override
    public int getMinimumLength() throws GuacamoleException {
        return environment.getProperty(MIN_LENGTH, 0);
    }

    @Override
    public int getMinimumAge() throws GuacamoleException {
        return environment.getProperty(MIN_AGE, 0);
    }

    @Override
    public int getMaximumAge() throws GuacamoleException {
        return environment.getProperty(MAX_AGE, 0);
    }

    @Override
    public int getHistorySize() throws GuacamoleException {
        return environment.getProperty(HISTORY_SIZE, 0);
    }

    @Override
    public boolean isMultipleCaseRequired() throws GuacamoleException {
        return environment.getProperty(REQUIRE_MULTIPLE_CASE, false);
    }

    @Override
    public boolean isNumericRequired() throws GuacamoleException {
        return environment.getProperty(REQUIRE_DIGIT, false);
    }

    @Override
    public boolean isNonAlphanumericRequired() throws GuacamoleException {
        return environment.getProperty(REQUIRE_SYMBOL, false);
    }

    @Override
    public boolean isUsernameProhibited() throws GuacamoleException {
        return environment.getProperty(PROHIBIT_USERNAME, false);
    }

}
