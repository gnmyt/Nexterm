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

package org.apache.guacamole.event;

import javax.annotation.Nonnull;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.event.ApplicationShutdownEvent;
import org.apache.guacamole.net.event.ApplicationStartedEvent;
import org.apache.guacamole.net.event.AuthenticationFailureEvent;
import org.apache.guacamole.net.event.AuthenticationRequestReceivedEvent;
import org.apache.guacamole.net.event.AuthenticationSuccessEvent;
import org.apache.guacamole.net.event.DirectoryEvent;
import org.apache.guacamole.net.event.DirectoryFailureEvent;
import org.apache.guacamole.net.event.DirectorySuccessEvent;
import org.apache.guacamole.net.event.IdentifiableObjectEvent;
import org.apache.guacamole.net.event.UserSessionInvalidatedEvent;
import org.apache.guacamole.net.event.listener.Listener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Listener that records each event that occurs in the logs, such as changes
 * made to objects via the REST API.
 */
public class EventLoggingListener implements Listener {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(EventLoggingListener.class);

    /**
     * Returns whether the given event affects the password of a User object.
     *
     * @param event
     *     The event to check.
     *
     * @return
     *     true if a user's password is specifically set or modified by the
     *     given event, false otherwise.
     */
    private boolean isPasswordAffected(IdentifiableObjectEvent<?> event) {

        Identifiable object = event.getObject();
        if (!(object instanceof User))
            return false;

        return ((User) object).getPassword() != null;
        
    }

    /**
     * Logs that an operation was performed on an object within a Directory
     * successfully.
     *
     * @param event
     *     The event describing the operation successfully performed on the
     *     object.
     */
    private void logSuccess(DirectorySuccessEvent<?> event) {
        DirectoryEvent.Operation op = event.getOperation();
        switch (op) {

            case GET:
                logger.debug("{} successfully accessed/retrieved {}", new RequestingUser(event), new AffectedObject(event));
                break;

            case ADD:
                if (isPasswordAffected(event))
                    logger.info("{} successfully created {}, setting their password", new RequestingUser(event), new AffectedObject(event));
                else
                    logger.info("{} successfully created {}", new RequestingUser(event), new AffectedObject(event));
                break;

            case UPDATE:
                if (isPasswordAffected(event))
                    logger.info("{} successfully updated {}, changing their password", new RequestingUser(event), new AffectedObject(event));
                else
                    logger.info("{} successfully updated {}", new RequestingUser(event), new AffectedObject(event));
                break;

            case REMOVE:
                logger.info("{} successfully deleted {}", new RequestingUser(event), new AffectedObject(event));
                break;

            default:
                logger.warn("DirectoryEvent operation type has no corresponding log message implemented: {}", op);
                logger.info("{} successfully performed an unknown action on {} {}", new RequestingUser(event), new AffectedObject(event));

        }
    }

    /**
     * Logs that an operation failed to be performed on an object within a
     * Directory.
     *
     * @param event
     *     The event describing the operation that failed.
     */
    private void logFailure(DirectoryFailureEvent<?> event) {
        DirectoryEvent.Operation op = event.getOperation();
        switch (op) {

            case GET:
                if (event.getFailure() instanceof GuacamoleResourceNotFoundException)
                    logger.debug("{} failed to access/retrieve {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));
                else
                    logger.info("{} failed to access/retrieve {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));
                break;

            case ADD:
                logger.info("{} failed to create {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));
                break;

            case UPDATE:
                logger.info("{} failed to update {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));
                break;

            case REMOVE:
                logger.info("{} failed to delete {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));
                break;

            default:
                logger.warn("DirectoryEvent operation type has no corresponding log message implemented: {}", op);
                logger.info("{} failed to perform an unknown action on {}: {}", new RequestingUser(event), new AffectedObject(event), new Failure(event));

        }
    }

    /**
     * Logs that authentication succeeded for a user.
     *
     * @param event
     *     The event describing the authentication attempt that succeeded.
     */
    private void logSuccess(AuthenticationSuccessEvent event) {
        if (!event.isExistingSession())
            logger.info("{} successfully authenticated from {}",
                    new RequestingUser(event),
                    new RemoteAddress(event.getCredentials()));
        else
            logger.debug("{} successfully re-authenticated their existing "
                    + "session from {}", new RequestingUser(event),
                    new RemoteAddress(event.getCredentials()));
    }

    /**
     * Logs that authentication failed for a user.
     *
     * @param event
     *     The event describing the authentication attempt that failed.
     */
    private void logFailure(AuthenticationFailureEvent event) {

        AuthenticationProvider authProvider = event.getAuthenticationProvider();

        Credentials creds = event.getCredentials();
        String username = creds.getUsername();

        if (creds.isEmpty())
            logger.debug("Empty authentication attempt (login screen "
                    + "initialization) from {} failed: {}",
                    new RemoteAddress(creds), new Failure(event));
        else if (username == null || username.isEmpty())
            logger.debug("Anonymous authentication attempt from {} failed: {}",
                    new RemoteAddress(creds), new Failure(event));
        else if (event.getFailure() instanceof GuacamoleInsufficientCredentialsException) {
            if (authProvider != null)
                logger.debug("Authentication attempt from {} for user \"{}\" "
                        + "requires additional credentials to continue: {} "
                        + "(requested by \"{}\")", new RemoteAddress(creds),
                        username, new Failure(event), authProvider.getIdentifier());
            else
                logger.debug("Authentication attempt from {} for user \"{}\" "
                        + "requires additional credentials to continue: {}",
                        new RemoteAddress(creds), username, new Failure(event));
        }
        else {
            if (authProvider != null)
                logger.warn("Authentication attempt from {} for user \"{}\" "
                        + "failed: {} (rejected by \"{}\")", new RemoteAddress(creds),
                        username, new Failure(event), authProvider.getIdentifier());
            else
                logger.warn("Authentication attempt from {} for user \"{}\" "
                        + "failed: {}", new RemoteAddress(creds), username,
                        new Failure(event));
        }

    }

    @Override
    public void handleEvent(@Nonnull Object event) throws GuacamoleException {

        // General object creation/modification/deletion
        if (event instanceof DirectorySuccessEvent)
            logSuccess((DirectorySuccessEvent<?>) event);
        else if (event instanceof DirectoryFailureEvent)
            logFailure((DirectoryFailureEvent<?>) event);

        // Login / logout / session expiration
        else if (event instanceof AuthenticationSuccessEvent)
            logSuccess((AuthenticationSuccessEvent) event);
        else if (event instanceof AuthenticationFailureEvent)
            logFailure((AuthenticationFailureEvent) event);
        else if (event instanceof UserSessionInvalidatedEvent)
            logger.info("{} has logged out, or their session has expired or "
                    + "been terminated.", new RequestingUser((UserSessionInvalidatedEvent) event));
        else if (event instanceof AuthenticationRequestReceivedEvent)
            logger.trace("Authentication request received from {}",
                    new RemoteAddress(((AuthenticationRequestReceivedEvent) event).getCredentials()));

        // Application startup/shutdown
        else if (event instanceof ApplicationStartedEvent)
            logger.info("The Apache Guacamole web application has started.");
        else if (event instanceof ApplicationShutdownEvent)
            logger.info("The Apache Guacamole web application has shut down.");

        // Unknown events
        else
            logger.debug("Ignoring unknown/unimplemented event type: {}",
                    event.getClass());

    }

}
