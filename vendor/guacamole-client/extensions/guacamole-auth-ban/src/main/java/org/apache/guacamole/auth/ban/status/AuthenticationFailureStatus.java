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

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The current status of an authentication failure, including the number of
 * times the failure has occurred.
 */
public class AuthenticationFailureStatus {

    /**
     * The timestamp of the last authentication failure, as returned by
     * System.nanoTime().
     */
    private long lastFailure;

    /**
     * The number of failures that have occurred.
     */
    private final AtomicInteger failureCount;

    /**
     * The maximum number of failures that may occur before the user/address
     * causing the failures is blocked.
     */
    private final int maxAttempts;

    /**
     * The amount of time that a user/address must remain blocked after they
     * have reached the maximum number of failures. Unlike the value provided
     * at construction time, this value is maintained in nanoseconds.
     */
    private final long duration;

    /**
     * Creates an AuthenticationFailureStatus that is initialized to zero
     * failures and is subject to the given restrictions. Additional failures
     * may be flagged after creation with {@link #notifyFailed()}.
     *
     * @param maxAttempts
     *     The maximum number of failures that may occur before the
     *     user/address causing the failures is blocked.
     *     
     * @param duration
     *     The amount of time, in seconds, that a user/address must remain
     *     blocked after they have reached the maximum number of failures.
     */
    public AuthenticationFailureStatus(int maxAttempts, int duration) {
        this.lastFailure = System.nanoTime();
        this.failureCount = new AtomicInteger(0);
        this.maxAttempts = maxAttempts;
        this.duration = TimeUnit.SECONDS.toNanos(duration);
    }

    /**
     * Updates this authentication failure, noting that the failure it
     * represents has recurred.
     */
    public void notifyFailed() {
        lastFailure = System.nanoTime();
        failureCount.incrementAndGet();
    }

    /**
     * Returns whether this authentication failure is recent enough that it
     * should still be tracked. This function will return false for
     * authentication failures that have not recurred for at least the duration
     * provided at construction time.
     *
     * @return
     *     true if this authentication failure is recent enough that it should
     *     still be tracked, false otherwise.
     */
    public boolean isValid() {
        return System.nanoTime() - lastFailure <= duration;
    }

    /**
     * Returns whether the user/address causing this authentication failure
     * should be blocked based on the restrictions provided at construction
     * time.
     *
     * @return
     *     true if the user/address causing this failure should be blocked,
     *     false otherwise.
     */
    public boolean isBlocked() {
        return isValid() && failureCount.get() >= maxAttempts;
    }

    /**
     * Returns the total number of authentication failures that have been
     * recorded through creating this object and invoking
     * {@link #notifyFailed()}.
     *
     * @return
     *     The total number of failures that have occurred.
     */
    public int getFailures() {
        return failureCount.get();
    }

}
