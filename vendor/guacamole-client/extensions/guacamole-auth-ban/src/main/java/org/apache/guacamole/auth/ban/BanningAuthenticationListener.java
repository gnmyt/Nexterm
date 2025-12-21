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

package org.apache.guacamole.auth.ban;

import org.apache.guacamole.auth.ban.status.AuthenticationFailureTracker;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.ban.status.InMemoryAuthenticationFailureTracker;
import org.apache.guacamole.auth.ban.status.NullAuthenticationFailureTracker;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.event.AuthenticationFailureEvent;
import org.apache.guacamole.net.event.AuthenticationSuccessEvent;
import org.apache.guacamole.net.event.listener.Listener;
import org.apache.guacamole.net.event.AuthenticationRequestReceivedEvent;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.LongGuacamoleProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Listener implementation which automatically tracks authentication failures
 * such that further authentication attempts may be automatically blocked if
 * they match configured criteria.
 */
public class BanningAuthenticationListener implements Listener {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(BanningAuthenticationListener.class);

    /**
     * The maximum number of failed authentication attempts allowed before an
     * address is temporarily banned.
     */
    private static final IntegerGuacamoleProperty MAX_ATTEMPTS = new IntegerGuacamoleProperty() {

        @Override
        public String getName() {
            return "ban-max-invalid-attempts";
        }

    };

    /**
     * The length of time that each address should be banned after reaching the
     * maximum number of failed authentication attempts, in seconds.
     */
    private static final IntegerGuacamoleProperty IP_BAN_DURATION = new IntegerGuacamoleProperty() {

        @Override
        public String getName() {
            return "ban-address-duration";
        }

    };

    /**
     * The maximum number of failed authentication attempts tracked at any
     * given time. Once this number of addresses is exceeded, the oldest
     * authentication attempts are rotated off on an LRU basis.
     */
    private static final LongGuacamoleProperty MAX_ADDRESSES = new LongGuacamoleProperty() {

        @Override
        public String getName() {
            return "ban-max-addresses";
        }

    };

    /**
     * The default maximum number of failed authentication attempts allowed
     * before an address is temporarily banned.
     */
    private static final int DEFAULT_MAX_ATTEMPTS = 5;

    /**
     * The default length of time that each address should be banned after
     * reaching the maximum number of failed authentication attempts, in
     * seconds.
     */
    private static final int DEFAULT_IP_BAN_DURATION = 300;

    /**
     * The maximum number of failed authentication attempts tracked at any
     * given time. Once this number of addresses is exceeded, the oldest
     * authentication attempts are rotated off on an LRU basis.
     */
    private static final long DEFAULT_MAX_ADDRESSES = 10485760;

    /**
     * Tracker of addresses that have repeatedly failed authentication.
     */
    private final AuthenticationFailureTracker tracker;

    /**
     * Creates a new BanningAuthenticationListener which automatically bans
     * further authentication attempts from addresses that have repeatedly
     * failed to authenticate. The ban duration and maximum number of failed
     * attempts allowed before banning are configured within
     * guacamole.properties.
     *
     * @throws GuacamoleException
     *     If an error occurs parsing the configuration properties used by this
     *     extension.
     */
    public BanningAuthenticationListener() throws GuacamoleException {

        Environment environment = LocalEnvironment.getInstance();
        int maxAttempts = environment.getProperty(MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
        int banDuration = environment.getProperty(IP_BAN_DURATION, DEFAULT_IP_BAN_DURATION);
        long maxAddresses = environment.getProperty(MAX_ADDRESSES, DEFAULT_MAX_ADDRESSES);

        // Configure auth failure tracking behavior and inform administrator of
        // ultimate result
        if (maxAttempts <= 0) {
            this.tracker = new NullAuthenticationFailureTracker();
            logger.info("Maximum failed authentication attempts has been set "
                    + "to {}. Automatic banning of brute-force authentication "
                    + "attempts will be disabled.", maxAttempts);
        }
        else if (banDuration <= 0) {
            this.tracker = new NullAuthenticationFailureTracker();
            logger.info("Ban duration for addresses that repeatedly fail "
                    + "authentication has been set to {}. Automatic banning "
                    + "of brute-force authentication attempts will be "
                    + "disabled.", banDuration);
        }
        else if (maxAddresses <= 0) {
            this.tracker = new NullAuthenticationFailureTracker();
            logger.info("Maximum number of tracked addresses has been set to "
                    + "{}. Automatic banning of brute-force authentication "
                    + "attempts will be disabled.", maxAddresses);
        }
        else {
            this.tracker = new InMemoryAuthenticationFailureTracker(maxAttempts, banDuration, maxAddresses);
            logger.info("Addresses will be automatically banned for {} "
                    + "seconds after {} failed authentication attempts. Up "
                    + "to {} unique addresses will be tracked/banned at any "
                    + "given time.", banDuration, maxAttempts, maxAddresses);
        }

    }

    @Override
    public void handleEvent(Object event) throws GuacamoleException {

        // Notify auth tracker of each request received BEFORE the request is
        // processed ...
        if (event instanceof AuthenticationRequestReceivedEvent) {
            AuthenticationRequestReceivedEvent request = (AuthenticationRequestReceivedEvent) event;
            tracker.notifyAuthenticationRequestReceived(request.getCredentials());
        }

        // ... as well as every explicit failure ...
        else if (event instanceof AuthenticationFailureEvent) {

            AuthenticationFailureEvent failure = (AuthenticationFailureEvent) event;

            // Requests for additional credentials are not failures per se,
            // but continuations of a multi-request authentication attempt that
            // has not yet succeeded OR failed
            if (failure.getFailure() instanceof GuacamoleInsufficientCredentialsException) {
                tracker.notifyAuthenticationRequestReceived(failure.getCredentials());
                return;
            }

            // Consider all other errors to be failed auth attempts
            tracker.notifyAuthenticationFailed(failure.getCredentials());

        }

        // ... and explicit success.
        else if (event instanceof AuthenticationSuccessEvent) {
            AuthenticationSuccessEvent success = (AuthenticationSuccessEvent) event;
            tracker.notifyAuthenticationSuccess(success.getCredentials());
        }

    }

}
