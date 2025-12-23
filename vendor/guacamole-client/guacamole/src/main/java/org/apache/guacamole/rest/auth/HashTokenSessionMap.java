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

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.GuacamoleSession;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A HashMap-based implementation of the TokenSessionMap with support for
 * session timeouts.
 */
public class HashTokenSessionMap implements TokenSessionMap {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(HashTokenSessionMap.class);

    /**
     * Executor service which runs the period session eviction task.
     */
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(1);
    
    /**
     * Keeps track of the authToken to GuacamoleSession mapping.
     */
    private final ConcurrentMap<String, GuacamoleSession> sessionMap =
            new ConcurrentHashMap<String, GuacamoleSession>();

    /**
     * The session timeout for the Guacamole REST API, in minutes.
     */
    private final IntegerGuacamoleProperty API_SESSION_TIMEOUT =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "api-session-timeout"; }

    };

    /**
     * Create a new HashTokenSessionMap configured using the given environment.
     *
     * @param environment
     *     The environment to use when configuring the token session map.
     */
    public HashTokenSessionMap(Environment environment) {
        
        int sessionTimeoutValue;

        // Read session timeout from guacamole.properties
        try {
            sessionTimeoutValue = environment.getProperty(API_SESSION_TIMEOUT, 60);
        }
        catch (GuacamoleException e) {
            logger.error("Unable to read guacamole.properties: {}", e.getMessage());
            logger.debug("Error while reading session timeout value.", e);
            sessionTimeoutValue = 60;
        }
        
        // Check for expired sessions every minute
        logger.info("Sessions will expire after {} minutes of inactivity.", sessionTimeoutValue);
        executor.scheduleAtFixedRate(new SessionEvictionTask(sessionTimeoutValue * 60000l), 1, 1, TimeUnit.MINUTES);
        
    }

    /**
     * Task which iterates through all active sessions, evicting those sessions
     * which are beyond the session timeout, or are marked as invalid by an
     * extension.
     */
    private class SessionEvictionTask implements Runnable {

        /**
         * The maximum allowed age of any session, in milliseconds.
         */
        private final long sessionTimeout;

        /**
         * Creates a new task which automatically evicts sessions which are
         * older than the specified timeout, or are marked as invalid by an
         * extension.
         * 
         * @param sessionTimeout The maximum age of any session, in
         *                       milliseconds.
         */
        public SessionEvictionTask(long sessionTimeout) {
            this.sessionTimeout = sessionTimeout;
        }

        /**
         * Iterates through all active sessions, evicting those sessions which
         * are beyond the session timeout, or are marked as invalid. Internal
         * errors which would otherwise stop the session eviction process are
         * caught, logged, and the process is allowed to proceed.
         */
        private void evictExpiredOrInvalidSessions() {

            // Get start time of session check time
            long sessionCheckStart = System.currentTimeMillis();

            logger.debug("Checking for expired or invalid sessions...");

            // For each session, remove sesions which have expired
            Iterator<Map.Entry<String, GuacamoleSession>> entries = sessionMap.entrySet().iterator();
            while (entries.hasNext()) {

                Map.Entry<String, GuacamoleSession> entry = entries.next();
                GuacamoleSession session = entry.getValue();

                try {

                    // Invalidate any sessions which have been flagged as invalid by extensions
                    if (!session.isValid()) {
                        logger.debug(
                                "Session \"{}\" has been invalidated by an extension.",
                                entry.getKey());
                        entries.remove();
                        session.invalidate();
                    }

                    // Do not expire sessions which are active
                    if (session.hasTunnels())
                        continue;

                    // Get elapsed time since last access
                    long age = sessionCheckStart - session.getLastAccessedTime();

                    // If session is too old, evict it and check the next one
                    if (age >= sessionTimeout) {
                        logger.debug("Session \"{}\" has timed out.", entry.getKey());
                        entries.remove();
                        session.invalidate();
                    }

                }
                catch (Throwable t) {
                    logger.error("An unexpected internal error prevented a "
                            + "session from being invalidated. This should "
                            + "NOT happen and is likely a bug. Depending on "
                            + "the nature of the failure, the session may "
                            + "still be valid.", t);
                }

            }

            // Log completion and duration
            logger.debug("Session check completed in {} ms.",
                    System.currentTimeMillis() - sessionCheckStart);
            
        }

        @Override
        public void run() {

            // The evictExpiredOrInvalidSessions() function should already
            // automatically handle and log all unexpected internal errors,
            // but wrap the entire call in a try/catch plus additional logging
            // to ensure that absolutely no errors can result in the entire
            // thread dying
            try {
                evictExpiredOrInvalidSessions();
            }
            catch (Throwable t) {
                logger.error("An unexpected internal error prevented the "
                        + "session eviction task from completing "
                        + "successfully. This should NOT happen and is likely "
                        + "a bug. Sessions that should have expired may "
                        + "remain valid.", t);
            }

        }

    }

    @Override
    public GuacamoleSession get(String authToken) {
        
        // There are no null auth tokens
        if (authToken == null)
            return null;

        // Return the GuacamoleSession having the given auth token (NOTE: We
        // do not update the access time here, as it is necessary to be able
        // to retrieve and check the session without causing that session to
        // be marked as active. Instead, those updates occur as needed when
        // functions within the GuacamoleSession are invoked.)
        return sessionMap.get(authToken);

    }

    @Override
    public void put(String authToken, GuacamoleSession session) {
        sessionMap.put(authToken, session);
    }

    @Override
    public GuacamoleSession remove(String authToken) {

        // There are no null auth tokens
        if (authToken == null)
            return null;

        // Attempt to retrieve only if non-null
        return sessionMap.remove(authToken);

    }

    @Override
    public void shutdown() {

        // Terminate the automatic session invalidation thread
        executor.shutdownNow();

        // Forcibly invalidate any remaining sessions
        sessionMap.values().stream().forEach(GuacamoleSession::invalidate);

    }

}
