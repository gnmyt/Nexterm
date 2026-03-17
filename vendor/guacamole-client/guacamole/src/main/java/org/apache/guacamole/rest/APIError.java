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

package org.apache.guacamole.rest;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.language.Translatable;
import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.auth.credentials.GuacamoleCredentialsException;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.apache.guacamole.rest.jsonpatch.APIPatchFailureException;
import org.apache.guacamole.rest.jsonpatch.APIPatchOutcome;
import org.apache.guacamole.tunnel.GuacamoleStreamException;

/**
 * Describes an error that occurred within a REST endpoint.
 */
public class APIError {

    /**
     * The translation key of the generic translation string which should be
     * used to display arbitrary messages which otherwise have no translation
     * string.
     */
    private static final String UNTRANSLATED_MESSAGE_KEY = "APP.TEXT_UNTRANSLATED";

    /**
     * The name of the placeholder within the translation string associated with
     * UNTRANSLATED_MESSAGE_KEY that should receive the raw, untranslated text.
     */
    private static final String UNTRANSLATED_MESSAGE_VARIABLE_NAME = "MESSAGE";

    /**
     * The human-readable error message.
     */
    private final String message;

    /**
     * A translatable message representing the error that occurred.
     */
    private final TranslatableMessage translatableMessage;

    /**
     * The associated Guacamole protocol status code.
     */
    private final Integer statusCode;

    /**
     * All expected request parameters, if any, as a collection of fields.
     */
    private final Collection<Field> expected;

    /**
     * The outcome of each patch in the associated request, if this was a
     * JSON Patch request. Otherwise null.
     */
    private List<APIPatchOutcome> patches = null;

    /**
     * The type of error that occurred.
     */
    private final Type type;

    /**
     * All possible types of REST API errors.
     */
    public enum Type {

        /**
         * The requested operation could not be performed because the request
         * itself was malformed.
         */
        BAD_REQUEST,

        /**
         * The credentials provided were invalid.
         */
        INVALID_CREDENTIALS,

        /**
         * The credentials provided were not necessarily invalid, but were not
         * sufficient to determine validity.
         */
        INSUFFICIENT_CREDENTIALS,

        /**
         * An internal server error has occurred.
         */
        INTERNAL_ERROR,

        /**
         * An object related to the request does not exist.
         */
        NOT_FOUND,

        /**
         * Permission was denied to perform the requested operation.
         */
        PERMISSION_DENIED,

        /**
         * An error occurred within an intercepted stream, terminating that
         * stream. The Guacamole protocol status code of that error can be
         * retrieved with getStatusCode().
         */
        STREAM_ERROR;

        /**
         * Returns the REST API error type which corresponds to the type of the
         * given exception.
         *
         * @param exception
         *     The exception to use to derive the API error type.
         *
         * @return
         *     The API error type which corresponds to the type of the given
         *     exception.
         */
        public static Type fromGuacamoleException(GuacamoleException exception) {

            // Additional credentials are needed
            if (exception instanceof GuacamoleInsufficientCredentialsException)
                return INSUFFICIENT_CREDENTIALS;

            // The provided credentials are wrong
            if (exception instanceof GuacamoleInvalidCredentialsException)
                return INVALID_CREDENTIALS;

            // Generic permission denied
            if (exception instanceof GuacamoleSecurityException)
                return PERMISSION_DENIED;

            // Arbitrary resource not found
            if (exception instanceof GuacamoleResourceNotFoundException)
                return NOT_FOUND;

            // Arbitrary bad requests
            if (exception instanceof GuacamoleClientException)
                return BAD_REQUEST;

            // Errors from intercepted streams
            if (exception instanceof GuacamoleStreamException)
                return STREAM_ERROR;

            // All other errors
            return INTERNAL_ERROR;

        }

    }

    /**
     * Creates a new APIError which exposes the details of the given
     * GuacamoleException. If the given GuacamoleException implements
     * Translatable, then its translation string and values will be exposed as
     * well.
     *
     * @param exception
     *     The GuacamoleException from which the details of the new APIError
     *     should be derived.
     */
    public APIError(GuacamoleException exception) {

        // Build base REST service error
        this.type = Type.fromGuacamoleException(exception);
        this.message = exception.getMessage();

        // Add expected credentials if applicable
        if (exception instanceof GuacamoleCredentialsException) {
            GuacamoleCredentialsException credentialsException = (GuacamoleCredentialsException) exception;
            this.expected = credentialsException.getCredentialsInfo().getFields();
        }
        else
            this.expected = null;

        // Add stream status code if applicable
        if (exception instanceof GuacamoleStreamException) {
            GuacamoleStreamException streamException = (GuacamoleStreamException) exception;
            this.statusCode = streamException.getStatus().getGuacamoleStatusCode();
        }
        else
            this.statusCode = null;

        // Pull translatable message and values if available
        if (exception instanceof Translatable) {
            Translatable translatable = (Translatable) exception;
            this.translatableMessage = translatable.getTranslatableMessage();
        }

        // Use generic translation string if message is not translated
        else
            this.translatableMessage = new TranslatableMessage(UNTRANSLATED_MESSAGE_KEY,
                    Collections.singletonMap(UNTRANSLATED_MESSAGE_VARIABLE_NAME, this.message));

        if (exception instanceof APIPatchFailureException)
            this.patches = ((APIPatchFailureException) exception).getPatches();

    }

    /**
     * Returns the type of error that occurred.
     *
     * @return
     *     The type of error that occurred.
     */
    public Type getType() {
        return type;
    }

    /**
     * Returns the Guacamole protocol status code associated with the error
     * that occurred. This is only valid for errors of type STREAM_ERROR.
     *
     * @return
     *     The Guacamole protocol status code associated with the error that
     *     occurred. If the error is not of type STREAM_ERROR, this will be
     *     null.
     */
    public Integer getStatusCode() {
        return statusCode;
    }

    /**
     * Returns a collection of all required parameters, where each parameter is
     * represented by a field.
     *
     * @return
     *     A collection of all required parameters.
     */
    public Collection<Field> getExpected() {
        return expected;
    }

    /**
     * Return the outcome for every patch in the request, if the request was
     * a JSON patch request. Otherwise, null.
     *
     * @return
     *     The outcome for every patch if responding to a JSON Patch request,
     *     otherwise null.
     */
    public List<APIPatchOutcome> getPatches() {
        return patches;
    }

    /**
     * Returns a human-readable error message describing the error that
     * occurred.
     *
     * @return
     *     A human-readable error message.
     */
    public String getMessage() {
        return message;
    }

    /**
     * Returns a translatable message describing the error that occurred. If no
     * translatable message is associated with the error, this will be null.
     *
     * @return
     *     A translatable message describing the error that occurred, or null
     *     if there is no such message defined.
     */
    public TranslatableMessage getTranslatableMessage() {
        return translatableMessage;
    }

}
