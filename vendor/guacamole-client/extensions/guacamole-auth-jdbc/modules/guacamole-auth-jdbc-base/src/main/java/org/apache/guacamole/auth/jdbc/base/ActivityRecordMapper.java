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

import java.util.Collection;
import java.util.List;
import org.apache.guacamole.auth.jdbc.user.UserModel;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.ibatis.annotations.Param;

/**
 * Common interface for mapping activity records.
 *
 * @param <ModelType>
 *     The type of model object representing the activity records mapped by
 *     this mapper.
 */
public interface ActivityRecordMapper<ModelType> {

    /**
     * Inserts the given activity record.
     *
     * @param record
     *     The activity record to insert.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     The number of rows inserted.
     */
    int insert(@Param("record") ModelType record,
               @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Updates the given activity record in the database, assigning an end
     * date. No column of the existing activity record is updated except for
     * the end date. If the record does not actually exist, this operation has
     * no effect.
     *
     * @param record
     *     The activity record to update.
     *
     * @return
     *     The number of rows updated.
     */
    int updateEndDate(@Param("record") ModelType record);

    /**
     * Searches for up to <code>limit</code> activity records that contain
     * the given terms, sorted by the given predicates, regardless of whether
     * the data they are associated with is readable by any particular user.
     * This should only be called on behalf of a system administrator. If
     * records are needed by a non-administrative user who must have explicit
     * read rights, use {@link searchReadable()} instead.
     *
     * @param identifier
     *     The optional identifier of the object whose history is being
     *     retrieved, or null if records related to any such object should be
     *     retrieved.
     *
     * @param recordIdentifier
     *     The identifier of the specific history record to retrieve, if not
     *     all matching records. Search terms, etc. will still be applied to
     *     the single record.
     *
     * @param terms
     *     The search terms that must match the returned records.
     *
     * @param sortPredicates
     *     A list of predicates to sort the returned records by, in order of
     *     priority.
     *
     * @param limit
     *     The maximum number of records that should be returned.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     The results of the search performed with the given parameters.
     */
    List<ModelType> search(@Param("identifier") String identifier,
            @Param("recordIdentifier") String recordIdentifier,
            @Param("terms") Collection<ActivityRecordSearchTerm> terms,
            @Param("sortPredicates") List<ActivityRecordSortPredicate> sortPredicates,
            @Param("limit") int limit,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

    /**
     * Searches for up to <code>limit</code> activity records that contain
     * the given terms, sorted by the given predicates. Only records that are
     * associated with data explicitly readable by the given user will be
     * returned. If records are needed by a system administrator (who, by
     * definition, does not need explicit read rights), use {@link search()}
     * instead.
     *
     * @param identifier
     *     The optional identifier of the object whose history is being
     *     retrieved, or null if records related to any such object should be
     *     retrieved.
     *
     * @param user
     *    The user whose permissions should determine whether a record is
     *    returned.
     *
     * @param recordIdentifier
     *     The identifier of the specific history record to retrieve, if not
     *     all matching records. Search terms, etc. will still be applied to
     *     the single record.
     *
     * @param terms
     *     The search terms that must match the returned records.
     *
     * @param sortPredicates
     *     A list of predicates to sort the returned records by, in order of
     *     priority.
     *
     * @param limit
     *     The maximum number of records that should be returned.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the user. If
     *     no groups are given, only permissions directly granted to the user
     *     will be used.
     * 
     * @param caseSensitivity
     *     The object that contains current configuration for case sensitivity
     *     for usernames and group names.
     *
     * @return
     *     The results of the search performed with the given parameters.
     */
    List<ModelType> searchReadable(@Param("identifier") String identifier,
            @Param("user") UserModel user,
            @Param("recordIdentifier") String recordIdentifier,
            @Param("terms") Collection<ActivityRecordSearchTerm> terms,
            @Param("sortPredicates") List<ActivityRecordSortPredicate> sortPredicates,
            @Param("limit") int limit,
            @Param("effectiveGroups") Collection<String> effectiveGroups,
            @Param("caseSensitivity") CaseSensitivity caseSensitivity);

}
