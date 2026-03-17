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

package org.apache.guacamole.auth.ban.status;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.language.TranslatableGuacamoleClientTooManyException;
import org.apache.guacamole.net.auth.Credentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AuthenticationFailureTracker implementation that tracks the failure status
 * of each IP address in memory. The maximum amount of memory consumed is
 * bounded by the configured maximum number of addresses tracked.
 */
public class InMemoryAuthenticationFailureTracker implements AuthenticationFailureTracker {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(InMemoryAuthenticationFailureTracker.class);

    /**
     * All authentication failures currently being tracked, stored by the
     * associated IP address.
     */
    private final Cache<String, AuthenticationFailureStatus> failures;

    /**
     * The maximum number of failed authentication attempts allowed before an
     * address is temporarily banned.
     */
    private final int maxAttempts;

    /**
     * The length of time that each address should be banned after reaching the
     * maximum number of failed authentication attempts, in seconds.
     */
    private final int banDuration;

    /**
     * Creates a new AuthenticationFailureTracker that automatically blocks
     * authentication attempts based on the provided blocking criteria.
     *
     * @param maxAttempts
     *     The maximum number of failed authentication attempts allowed before
     *     an address is temporarily banned.
     *
     * @param banDuration
     *     The length of time that each address should be banned after reaching
     *     the maximum number of failed authentication attempts, in seconds.
     *
     * @param maxAddresses
     *     The maximum number of unique IP addresses that should be tracked
     *     before discarding older tracked failures.
     */
    public InMemoryAuthenticationFailureTracker(int maxAttempts, int banDuration,
            long maxAddresses) {

        this.maxAttempts = maxAttempts;
        this.banDuration = banDuration;

        // Limit maximum number of tracked addresses to configured upper bound
        this.failures = Caffeine.newBuilder()
                .maximumSize(maxAddresses)
                .build();

    }

    /**
     * Reports that the given address has just failed to authenticate and
     * returns the AuthenticationFailureStatus that represents that failure. If
     * the address isn't already being tracked, it will begin being tracked as
     * of this call. If the address is already tracked, the returned
     * AuthenticationFailureStatus will represent past authentication failures,
     * as well.
     *
     * @param address
     *     The address that has failed to authenticate.
     *
     * @return
     *     An AuthenticationFailureStatus that represents this latest
     *     authentication failure for the given address, as well as any past
     *     failures.
     */
    private AuthenticationFailureStatus getAuthenticationFailure(String address) {

        AuthenticationFailureStatus status = failures.get(address,
                (addr) -> new AuthenticationFailureStatus(maxAttempts, banDuration));

        status.notifyFailed();
        return status;

    }

    /**
     * Reports that an authentication request has been received, as well as
     * whether that request is known to have failed. If the associated address
     * is currently being blocked, an exception will be thrown.
     *
     * @param credentials
     *     The credentials associated with the authentication request.
     *
     * @param failed
     *     Whether the request is known to have failed. If the status of the
     *     request is not yet known, this should be false.
     *
     * @throws GuacamoleException
     *     If the authentication request is being blocked due to brute force
     *     prevention rules.
     */
    private void notifyAuthenticationStatus(Credentials credentials,
            boolean failed) throws GuacamoleException {

        // Ignore requests that do not contain explicit parameters of any kind
        if (credentials.isEmpty())
            return;

        // Determine originating address of the authentication request
        String address = credentials.getRemoteAddress();
        if (address == null)
            throw new GuacamoleServerException("Source address cannot be determined.");

        // Get current failure status for the address associated with the
        // authentication request, adding/updating that status if the request
        // was itself a failure
        AuthenticationFailureStatus status;
        if (failed) {
            status = getAuthenticationFailure(address);
            logger.info("Authentication has failed for address \"{}\" (current total failures: {}/{}).",
                    address, status.getFailures(), maxAttempts);
        }
        else
            status = failures.getIfPresent(address);

        if (status != null) {

            // Explicitly block further processing of authentication/authorization
            // if too many failures have occurred
            if (status.isBlocked()) {
                logger.warn("Blocking authentication attempt from address \"{}\" due to number of authentication failures.", address);
                throw new TranslatableGuacamoleClientTooManyException("Too "
                        + "many failed authentication attempts.",
                        "LOGIN.ERROR_TOO_MANY_ATTEMPTS");
            }

            // Clean up tracking of failures if the address is no longer
            // relevant (all failures are sufficiently old)
            else if (!status.isValid()) {
                logger.debug("Removing address \"{}\" from tracking as there are no recent authentication failures.", address);
                failures.invalidate(address);
            }

        }

    }

    @Override
    public void notifyAuthenticationRequestReceived(Credentials credentials)
            throws GuacamoleException {
        notifyAuthenticationStatus(credentials, false);
    }

    @Override
    public void notifyAuthenticationSuccess(Credentials credentials)
            throws GuacamoleException {
        notifyAuthenticationStatus(credentials, false);
    }

    @Override
    public void notifyAuthenticationFailed(Credentials credentials)
            throws GuacamoleException {
        notifyAuthenticationStatus(credentials, true);
    }

}
