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

import java.util.UUID;
import org.apache.guacamole.net.GuacamoleTunnel;

/**
 * A logging record describing when a user started and ended usage of a
 * particular connection.
 */
public interface ConnectionRecord extends ActivityRecord {

    /**
     * Returns the identifier of the connection associated with this
     * connection record.
     *
     * @return
     *     The identifier of the connection associated with this connection
     *     record.
     */
    public String getConnectionIdentifier();
    
    /**
     * Returns the name of the connection associated with this connection
     * record.
     *
     * @return
     *     The name of the connection associated with this connection record.
     */
    public String getConnectionName();

    /**
     * Returns the identifier of the sharing profile that was used to access the
     * connection associated with this connection record. If the connection was
     * accessed directly (without involving a sharing profile), this will be
     * null.
     *
     * @return
     *     The identifier of the sharing profile used to access the connection
     *     associated with this connection record, or null if the connection
     *     was accessed directly.
     */
    public String getSharingProfileIdentifier();

    /**
     * Returns the name of the sharing profile that was used to access the
     * connection associated with this connection record. If the connection was
     * accessed directly (without involving a sharing profile), this will be
     * null.
     *
     * @return
     *     The name of the sharing profile used to access the connection
     *     associated with this connection record, or null if the connection
     *     was accessed directly.
     */
    public String getSharingProfileName();

    /**
     * {@inheritDoc}
     * <p>If implemented, this UUID SHOULD be identical to the UUID of the
     * {@link GuacamoleTunnel} originally returned when the connection was
     * established to allow extensions and/or the web application to
     * automatically associate connection information with corresponding
     * history records, such as log messages and session recordings.
     */
    @Override
    public default UUID getUUID() {
        return null;
    }

}
