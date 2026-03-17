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

package org.apache.guacamole.auth.jdbc.connection;

import com.google.inject.Inject;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSearchTerm;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSortPredicate;
import org.apache.guacamole.auth.jdbc.base.ModeledActivityRecordSet;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.ConnectionRecord;

/**
 * A JDBC implementation of ActivityRecordSet for ConnectionRecords. Calls to
 * asCollection() will query connection history records from the database. Which
 * records are returned will be determined by the values passed in earlier.
 */
public class ConnectionRecordSet extends ModeledActivityRecordSet<ConnectionRecord> {

    /**
     * The namespace for the type 3 UUIDs generated for connection history
     * records. This UUID namespace is itself a type 3 UUID within the "ns:OID"
     * namespace for the OID "1.3.6.1.4.1.18060.18.2.1.2", which has been
     * specifically allocated for Apache Guacamole database connection
     * history records.
     */
    public static final UUID UUID_NAMESPACE = UUID.fromString("8b55f070-95f4-3d31-93ee-9c5845e7aa40");

    /**
     * Service for managing connection objects.
     */
    @Inject
    private ConnectionService connectionService;
    
    /**
     * The identifier of the connection to which this record set should be
     * limited, if any. If null, the set should contain all records readable
     * by the user making the request.
     */
    private String identifier = null;
    
    /**
     * Initializes this object, associating it with the current authenticated
     * user and connection identifier.
     *
     * @param currentUser
     *     The user that created or retrieved this object.
     * 
     * @param identifier
     *     The connection identifier to which this record set should be limited,
     *     or null if the record set should contain all records readable by the
     *     currentUser.
     */
    protected void init(ModeledAuthenticatedUser currentUser, String identifier) {
        super.init(currentUser);
        this.identifier = identifier;
    }
    
    @Override
    protected List<ConnectionRecord> retrieveHistory(
            AuthenticatedUser user, String recordIdentifier,
            Set<ActivityRecordSearchTerm> requiredContents,
            List<ActivityRecordSortPredicate> sortPredicates,
            int limit) throws GuacamoleException {

        // Retrieve history from database
        return connectionService.retrieveHistory(identifier, getCurrentUser(),
                recordIdentifier, requiredContents, sortPredicates, limit);

    }

}
