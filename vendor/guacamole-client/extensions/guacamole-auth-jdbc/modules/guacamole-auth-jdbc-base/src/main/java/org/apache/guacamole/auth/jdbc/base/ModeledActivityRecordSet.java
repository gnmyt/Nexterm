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

package org.apache.guacamole.auth.jdbc.base;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.ActivityRecordSet.SortableProperty;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A JDBC implementation of ActivityRecordSet. Calls to asCollection() will
 * query history records using an implementation-specific mechanism. Which
 * records are returned will be determined by the values passed in earlier.
 *
 * @param <RecordType>
 *     The type of ActivityRecord contained within this set.
 */
public abstract class ModeledActivityRecordSet<RecordType extends ActivityRecord>
        extends RestrictedObject implements ActivityRecordSet<RecordType> {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ModeledActivityRecordSet.class);
    
    /**
     * The set of strings that each must occur somewhere within the returned 
     * records, whether within the associated username, an associated date, or
     * other related data. If non-empty, any record not matching each of the
     * strings within the collection will be excluded from the results.
     */
    private final Set<ActivityRecordSearchTerm> requiredContents =
            new HashSet<>();
    
    /**
     * The maximum number of history records that should be returned by a call
     * to asCollection().
     */
    private int limit = Integer.MAX_VALUE;
    
    /**
     * A list of predicates to apply while sorting the resulting records,
     * describing the properties involved and the sort order for those
     * properties.
     */
    private final List<ActivityRecordSortPredicate> sortPredicates =
            new ArrayList<>();

    /**
     * Retrieves the history records matching the given criteria. Retrieves up
     * to <code>limit</code> history records matching the given terms and sorted
     * by the given predicates. Only history records associated with data that
     * the given user can read are returned.
     *
     * @param user
     *     The user retrieving the history.
     *
     * @param recordIdentifier
     *     The identifier of the specific history record to retrieve, if not
     *     all matching records. Search terms, etc. will still be applied to
     *     the single record.
     *
     * @param requiredContents
     *     The search terms that must be contained somewhere within each of the
     *     returned records.
     *
     * @param sortPredicates
     *     A list of predicates to sort the returned records by, in order of
     *     priority.
     *
     * @param limit
     *     The maximum number of records that should be returned.
     *
     * @return
     *     A collection of all history records matching the given criteria.
     *
     * @throws GuacamoleException
     *     If permission to read the history records is denied.
     */
    protected abstract List<RecordType> retrieveHistory(
            AuthenticatedUser user, String recordIdentifier,
            Set<ActivityRecordSearchTerm> requiredContents,
            List<ActivityRecordSortPredicate> sortPredicates,
            int limit) throws GuacamoleException;

    @Override
    public RecordType get(String identifier) throws GuacamoleException {

        List<RecordType> records = retrieveHistory(getCurrentUser(),
                identifier, requiredContents, sortPredicates, limit);

        if (records.isEmpty())
            return null;

        if (records.size() == 1)
            return records.get(0);

        logger.warn("Multiple history records match ID \"{}\"! This should "
                + "not be possible and may indicate a bug or database "
                + "corruption.", identifier);
        return null;

    }

    @Override
    public Collection<RecordType> asCollection()
            throws GuacamoleException {
        return retrieveHistory(getCurrentUser(), null, requiredContents,
                sortPredicates, limit);
    }

    @Override
    public ModeledActivityRecordSet<RecordType> contains(String value)
            throws GuacamoleException {
        requiredContents.add(new ActivityRecordSearchTerm(value));
        return this;
    }

    @Override
    public ModeledActivityRecordSet<RecordType> limit(int limit) throws GuacamoleException {
        this.limit = Math.min(this.limit, limit);
        return this;
    }

    @Override
    public ModeledActivityRecordSet<RecordType> sort(SortableProperty property, boolean desc)
            throws GuacamoleException {
        
        sortPredicates.add(new ActivityRecordSortPredicate(
            property,
            desc
        ));
        
        return this;

    }

}
