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

import java.util.Map;

/**
 * Represents the semantics which apply to an existing connection when shared,
 * along with a human-readable name and unique identifier.
 */
public interface SharingProfile extends Identifiable, Attributes, Nameable {

    /**
     * Returns the identifier of the primary connection associated with this
     * connection. The primary connection is the connection that this sharing
     * profile can be used to share.
     *
     * @return
     *     The identifier of the primary connection associated with this
     *     connection.
     */
    public String getPrimaryConnectionIdentifier();

    /**
     * Sets the identifier of the primary connection associated with this
     * connection. The primary connection is the connection that this sharing
     * profile can be used to share.
     *
     * @param identifier
     *     The identifier of the primary connection associated with this
     *     connection.
     */
    public void setPrimaryConnectionIdentifier(String identifier);

    /**
     * Returns a map which contains connection parameter name/value pairs as
     * key/value pairs. Changes to this map will affect the parameters stored
     * within this sharing profile. The differences in these parameters compared
     * to those of the associated primary connection yield different levels of
     * access to users joining the primary connection via this sharing profile.
     * Note that because configurations may contain sensitive information, some
     * data in this map may be omitted or tokenized.
     *
     * @return
     *     A map which contains all connection parameter name/value pairs as
     *     key/value pairs.
     */
    public Map<String, String> getParameters();

    /**
     * Replaces all current parameters with the parameters defined within the
     * given map. Key/value pairs within the map represent parameter name/value
     * pairs. The differences in these parameters compared to those of the
     * associated primary connection yield different levels of access to users
     * joining the primary connection via this sharing profile.
     *
     * @param parameters
     *     A map which contains all connection parameter name/value pairs as
     *     key/value pairs.
     */
    public void setParameters(Map<String, String> parameters);

}
