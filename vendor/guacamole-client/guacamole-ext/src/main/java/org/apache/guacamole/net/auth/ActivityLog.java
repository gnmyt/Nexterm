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

package org.apache.guacamole.net.auth;

import java.io.InputStream;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * An arbitrary log of an activity whose content may be exposed to a user with
 * sufficient privileges. Types of content that might be exposed in this way
 * include textual server logs, Guacamole session recordings, and typescripts.
 */
public interface ActivityLog {

    /**
     * The value returned by {@link #getSize()} if the number of available
     * bytes within {@link #getContent()} is unknown.
     */
    public static final long UNKNOWN_SIZE = -1;

    /**
     * All possible types of {@link ActivityLog}.
     */
    enum Type {

        /**
         * A Guacamole session recording in the form of a Guacamole protocol
         * dump.
         */
        GUACAMOLE_SESSION_RECORDING("application/octet-stream"),

        /**
         * A text log from a server-side process, such as the Guacamole web
         * application or guacd.
         */
        SERVER_LOG("text/plain"),

        /**
         * A text session recording in the form of a standard typescript.
         */
        TYPESCRIPT("application/octet-stream"),

        /**
         * The timing file related to a typescript.
         */
        TYPESCRIPT_TIMING("text/plain");

        /**
         * The MIME type of the content of an activity log of this type.
         */
        private final String contentType;

        /**
         * Creates a new Type that may be associated with content having the
         * given MIME type.
         *
         * @param contentType
         *     The MIME type of the content of an activity log of this type.
         */
        Type(String contentType) {
            this.contentType = contentType;
        }

        /**
         * Returns the MIME type of the content of an activity log of this
         * type, as might be sent via the HTTP "Content-Type" header.
         *
         * @return
         *     The MIME type of the content of an activity log of this type.
         */
        public String getContentType() {
            return contentType;
        }

    }

    /**
     * Returns the type of this activity log. The type of an activity log
     * dictates how its content should be interpreted or exposed.
     *
     * @return
     *     The type of this activity log.
     */
    Type getType();

    /**
     * Returns a human-readable message that describes this log. This message
     * should provide sufficient information for a user with access to this
     * log to understand its context and/or purpose.
     *
     * @return
     *     A human-readable message that describes this log.
     */
    TranslatableMessage getDescription();

    /**
     * Returns the number of bytes available for reading within the content of
     * this log. If this value is unknown, -1 ({@link #UNKNOWN_SIZE}) should be
     * returned.
     *
     * @return
     *     The number of bytes available for reading within the content of
     *     this log, or -1 ({@link #UNKNOWN_SIZE}) if this value is unknown.
     *
     * @throws GuacamoleException
     *     If the size of the content of this log cannot be determined due to
     *     an error.
     */
    long getSize() throws GuacamoleException;

    /**
     * Returns an InputStream that allows the content of this log to be read.
     * Multiple instances of this InputStream may be open at any given time. It
     * is the responsibility of the caller to close the returned InputStream.
     *
     * @return
     *     An InputStream that allows the content of this log to be read.
     *
     * @throws GuacamoleException
     *     If the content of this log cannot be read due to an error.
     */
    InputStream getContent() throws GuacamoleException;

}
