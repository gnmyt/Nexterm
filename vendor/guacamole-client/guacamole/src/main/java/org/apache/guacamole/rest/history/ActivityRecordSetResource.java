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

package org.apache.guacamole.rest.history;

import java.util.ArrayList;
import java.util.List;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.ActivityRecordSet;

/**
 * A REST resource which abstracts the operations available on an
 * ActivityRecordSet, such as the connection or user history available via the
 * UserContext.
 *
 * @param <InternalRecordType>
 *     The type of ActivityRecord that is contained
 *     within the ActivityRecordSet represented by this resource. To avoid
 *     coupling the REST API too tightly to the extension API, these objects
 *     are not directly serialized or deserialized when handling REST requests.
 *
 * @param <ExternalRecordType>
 *     The type of object used in interchange (ie: serialized/deserialized as
 *     JSON) between REST clients and this resource to represent the
 *     InternalRecordType.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public abstract class ActivityRecordSetResource<InternalRecordType extends ActivityRecord,
        ExternalRecordType extends APIActivityRecord> {

    /**
     * The maximum number of history records to return in any one response.
     */
    private static final int MAXIMUM_HISTORY_SIZE = 1000;

    /**
     * The ActivityRecordSet whose records are being exposed.
     */
    private ActivityRecordSet<InternalRecordType> history;

    /**
     * Creates a new ActivityRecordSetResource which exposes the records within
     * the given ActivityRecordSet.
     *
     * @param history
     *     The ActivityRecordSet whose records should be exposed.
     */
    public ActivityRecordSetResource(ActivityRecordSet<InternalRecordType> history) {
        this.history = history;
    }

    /**
     * Converts the given internal record object to a record object which is
     * decoupled from the extension API and is intended to be used in
     * interchange via the REST API.
     *
     * @param record
     *     The record to convert for the sake of interchange.
     *
     * @return
     *     A new record object containing the same data as the given internal
     *     record, but intended for use in interchange.
     */
    protected abstract ExternalRecordType toExternalRecord(InternalRecordType record);

    /**
     * Applies the given search and sorting criteria to the ActivityRecordSet
     * exposed by this ActivityRecordSetResource. The ActivityRecordSet stored
     * as {@link #history} is modified as a result of this call.
     *
     * @param requiredContents
     *     The set of strings that each must occur somewhere within the
     *     returned records, whether within the associated username,
     *     the name of some associated object (such as a connection), or any
     *     associated date. If non-empty, any record not matching each of the
     *     strings within the collection will be excluded from the results.
     *
     * @param sortPredicates
     *     A list of predicates to apply while sorting the resulting records,
     *     describing the properties involved and the sort order for those
     *     properties.
     *
     * @throws GuacamoleException
     *     If an error occurs while applying the given filter criteria or
     *     sort predicates.
     */
    private void applyCriteria(List<String> requiredContents,
            List<APISortPredicate> sortPredicates) throws GuacamoleException {

        // Restrict to records which contain the specified strings
        for (String required : requiredContents) {
            if (!required.isEmpty())
                history = history.contains(required);
        }

        // Sort according to specified ordering
        for (APISortPredicate predicate : sortPredicates)
            history = history.sort(predicate.getProperty(), predicate.isDescending());

        // Limit to maximum result size
        history = history.limit(MAXIMUM_HISTORY_SIZE);

    }

    /**
     * Retrieves the list of activity records stored within the underlying
     * ActivityRecordSet which match the given, arbitrary criteria. If
     * specified, the returned records will also be sorted according to the
     * given sort predicates.
     *
     * @param requiredContents
     *     The set of strings that each must occur somewhere within the
     *     returned records, whether within the associated username,
     *     the name of some associated object (such as a connection), or any
     *     associated date. If non-empty, any record not matching each of the
     *     strings within the collection will be excluded from the results.
     *
     * @param sortPredicates
     *     A list of predicates to apply while sorting the resulting records,
     *     describing the properties involved and the sort order for those
     *     properties.
     *
     * @return
     *     The list of records which match the provided criteria, optionally
     *     sorted as specified.
     *
     * @throws GuacamoleException
     *     If an error occurs while applying the given filter criteria or
     *     sort predicates.
     */
    @GET
    public List<ExternalRecordType> getRecords(
            @QueryParam("contains") List<String> requiredContents,
            @QueryParam("order") List<APISortPredicate> sortPredicates)
            throws GuacamoleException {

        // Apply search/sort criteria
        applyCriteria(requiredContents, sortPredicates);
        
        // Convert record set to collection of API records
        List<ExternalRecordType> apiRecords = new ArrayList<>();
        for (InternalRecordType record : history.asCollection())
            apiRecords.add(toExternalRecord(record));

        // Return the converted history
        return apiRecords;

    }

    /**
     * Retrieves record having the given identifier from among the set of
     * activity records stored within the underlying ActivityRecordSet.
     *
     * @param identifier
     *     The unique identifier of the record to retrieve.
     *
     * @return
     *     A resource representing the record having the given identifier.
     *
     * @throws GuacamoleException
     *     If an error occurs while locating the requested record, or if the
     *     requested record cannot be found.
     */
    @Path("{identifier}")
    public ActivityRecordResource getRecord(@PathParam("identifier") String identifier)
                throws GuacamoleException {

        InternalRecordType record = history.get(identifier);
        if (record == null)
            throw new GuacamoleResourceNotFoundException("Not found: \"" + identifier + "\"");

        return new ActivityRecordResource(record, toExternalRecord(record));

    }

}
