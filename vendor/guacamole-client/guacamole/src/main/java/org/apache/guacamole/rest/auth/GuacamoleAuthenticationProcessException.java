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

import java.io.Serializable;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.apache.guacamole.protocol.GuacamoleStatus;

/**
 * An exception that occurs during Guacamole's authentication and authorization
 * process, possibly associated with a specific AuthenticationProvider.
 */
public class GuacamoleAuthenticationProcessException extends GuacamoleException {

    /**
     * Internal identifier unique to this version of
     * GuacamoleAuthenticationProcessException, as required by Java's
     * {@link Serializable} interface.
     */
    private static final long serialVersionUID = 1L;

    /**
     * The AuthenticationProvider that caused the failure, or null if there is
     * no such specific AuthenticationProvider involved in this failure.
     */
    private final transient AuthenticationProvider authProvider;

    /**
     * A GuacamoleException representation of the failure that occurred. If
     * the cause provided when this GuacamoleAuthenticationProcessException
     * was created was a GuacamoleException, this will just be that exception.
     * Otherwise, this will be a GuacamoleServerException wrapping the cause
     * or a generic GuacamoleInvalidCredentialsException requesting a
     * username/password if there is no specific cause at all.
     */
    private final GuacamoleException guacCause;

    /**
     * Converts the given Throwable to a GuacamoleException representing the
     * failure that occurred. If the Throwable already is a GuacamoleException,
     * this will just be that Throwable. For all other cases, a new
     * GuacamoleException will be created that best represents the provided
     * failure. If no failure is provided at all, a generic
     * GuacamoleInvalidCredentialsException requesting a username/password is
     * created.
     *
     * @param message
     *     A human-readable message describing the failure that occurred.
     *
     * @param cause
     *     The Throwable cause of the failure that occurred, if any, or null if
     *     the cause is not known to be a specific Throwable.
     *
     * @return
     *     A GuacamoleException representation of the message and cause
     *     provided.
     */
    private static GuacamoleException toGuacamoleException(String message,
            Throwable cause) {

        // Create generic invalid username/password exception if we have no
        // specific cause
        if (cause == null)
            return new GuacamoleInvalidCredentialsException(
                "Permission Denied.",
                CredentialsInfo.USERNAME_PASSWORD
            );

        // If the specific cause is already a GuacamoleException, there's
        // nothing for us to do here
        if (cause instanceof GuacamoleException)
            return (GuacamoleException) cause;

        // Wrap all other Throwables as generic internal errors
        return new GuacamoleServerException(message, cause);

    }

    /**
     * Creates a new GuacamoleAuthenticationProcessException with the given
     * message, associated AuthenticationProvider, and cause.
     *
     * @param message
     *     A human readable description of the exception that occurred.
     *
     * @param authProvider
     *     The AuthenticationProvider that caused the failure, or null if there
     *     is no such specific AuthenticationProvider involved in this failure.
     *
     * @param cause
     *     The cause of this exception, or null if the cause is unknown or
     *     there is no such cause.
     */
    public GuacamoleAuthenticationProcessException(String message,
            AuthenticationProvider authProvider, Throwable cause) {
        super(message, cause);
        this.authProvider = authProvider;
        this.guacCause = toGuacamoleException(message, cause);
    }

    /**
     * Returns the AuthenticationProvider that caused the failure, if any. If
     * there is no specific AuthenticationProvider involved in this failure,
     * including if the failure is due to multiple AuthenticationProviders,
     * this will be null.
     *
     * @return
     *     The AuthenticationProvider that caused the failure, or null if there
     *     is no such specific AuthenticationProvider involved in this failure.
     */
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    /**
     * Returns a GuacamoleException that represents the user-facing cause of
     * this exception. A GuacamoleException will be returned by this function
     * in all cases, including if no specific cause was given.
     *
     * @return
     *     A GuacamoleException that represents the user-facing cause of this
     *     exception.
     */
    public GuacamoleException getCauseAsGuacamoleException() {
        return guacCause;
    }

    /**
     * Rethrows the original GuacamoleException wrapped within this
     * GuacamoleAuthenticationProcessException. If there is no such exception,
     * and the cause of this failure is an unchecked RuntimeException or Error,
     * that unchecked exception/error is rethrown as-is.
     *
     * @throws GuacamoleException
     *     If the underlying cause of this exception is a checked
     *     GuacamoleException subclass.
     *
     * @throws RuntimeException
     *     If the underlying cause of this exception is an unchecked
     *     RuntimeException.
     *
     * @throws Error
     *     If the underlying cause of this exception is an unchecked Error.
     */
    public void rethrowCause() throws GuacamoleException, RuntimeException, Error {

        // Rethrow any unchecked exceptions/errors as-is
        Throwable cause = getCause();
        if (cause instanceof RuntimeException)
            throw (RuntimeException) cause;
        if (cause instanceof Error)
            throw (Error) cause;

        // Pass through all other exceptions as normal GuacamoleException
        // subclassses
        throw getCauseAsGuacamoleException();

    }

    @Override
    public GuacamoleStatus getStatus() {
        return getCauseAsGuacamoleException().getStatus();
    }

    @Override
    public int getHttpStatusCode() {
        return getCauseAsGuacamoleException().getHttpStatusCode();
    }

    @Override
    public int getWebSocketCode() {
        return getCauseAsGuacamoleException().getWebSocketCode();
    }

}
