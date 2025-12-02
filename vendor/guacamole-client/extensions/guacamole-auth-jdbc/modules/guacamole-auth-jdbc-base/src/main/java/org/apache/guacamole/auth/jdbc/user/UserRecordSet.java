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

package org.apache.guacamole.auth.jdbc.user;

import com.google.inject.Inject;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSearchTerm;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSortPredicate;
import org.apache.guacamole.auth.jdbc.base.ModeledActivityRecordSet;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.AuthenticatedUser;

/**
 * A JDBC implementation of ActivityRecordSet for retrieving user login history.
 * Calls to asCollection() will query user login records from the database.
 * Which records are returned will be determined by the values passed in
 * earlier.
 */
public class UserRecordSet extends ModeledActivityRecordSet<ActivityRecord> {

    /**
     * The namespace for the type 3 UUIDs generated for user history records.
     * This UUID namespace is itself a type 3 UUID within the "ns:OID"
     * namespace for the OID "1.3.6.1.4.1.18060.18.2.1.1", which has been
     * specifically allocated for Apache Guacamole database user history 
     * records.
     */
    public static final UUID UUID_NAMESPACE = UUID.fromString("e104741a-c949-3947-8d79-f3f2cdce7d6f");

    /**
     * Service for managing user objects.
     */
    @Inject
    private UserService userService;
    
    /**
     * The identifier that indicates which user object these records should be
     * limited to, if any. If null is specified (the default) then all records
     * that are readable by the current user will be retrieved.
     */
    private String identifier = null;
    
    /**
     * Initialize this UserRecordSet with currentUser requesting the login
     * records, and, optionally, the identifier of the user to which records
     * should be limited.
     * 
     * @param currentUser
     *     The user requesting login history.
     * 
     * @param identifier 
     *     The identifier of the user whose login history should be contained
     *     in this record set, or null if the record set should contain all
     *     records readable by the currentUser.
     */
    protected void init(ModeledAuthenticatedUser currentUser, String identifier) {
        super.init(currentUser);
        this.identifier = identifier;
    }
    
    @Override
    protected List<ActivityRecord> retrieveHistory(
            AuthenticatedUser user, String recordIdentifier,
            Set<ActivityRecordSearchTerm> requiredContents,
            List<ActivityRecordSortPredicate> sortPredicates, int limit)
            throws GuacamoleException {

        // Retrieve history from database
        return userService.retrieveHistory(identifier, getCurrentUser(),
                recordIdentifier, requiredContents, sortPredicates, limit);

    }

}
