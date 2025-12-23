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

import java.util.Collection;
import org.apache.guacamole.GuacamoleException;

/**
 * ActivityRecordSet implementation which simply delegates all function calls
 * to an underlying ActivityRecordSet.
 *
 * @param <RecordType>
 *     The type of ActivityRecord contained within this set.
 */
public class DelegatingActivityRecordSet<RecordType extends ActivityRecord>
        implements ActivityRecordSet<RecordType> {

    /**
     * The wrapped ActivityRecordSet.
     */
    private final ActivityRecordSet<RecordType> recordSet;

    /**
     * Wraps the given ActivityRecordSet such that all function calls against this
     * DelegatingActivityRecordSet will be delegated to it.
     *
     * @param recordSet
     *     The ActivityRecordSet to wrap.
     */
    public DelegatingActivityRecordSet(ActivityRecordSet<RecordType> recordSet) {
        this.recordSet = recordSet;
    }

    /**
     * Returns the underlying ActivityRecordSet wrapped by this
     * DelegatingActivityRecordSet.
     *
     * @return
     *     The ActivityRecordSet wrapped by this DelegatingActivityRecordSet.
     */
    protected ActivityRecordSet<RecordType> getDelegateActivityRecordSet() {
        return recordSet;
    }

    @Override
    public RecordType get(String identifier) throws GuacamoleException {
        return recordSet.get(identifier);
    }

    @Override
    public Collection<RecordType> asCollection() throws GuacamoleException {
        return recordSet.asCollection();
    }

    @Override
    public ActivityRecordSet<RecordType> contains(String value) throws GuacamoleException {
        return recordSet.contains(value);
    }

    @Override
    public ActivityRecordSet<RecordType> limit(int limit) throws GuacamoleException {
        return recordSet.limit(limit);
    }

    @Override
    public ActivityRecordSet<RecordType> sort(SortableProperty property,
            boolean desc) throws GuacamoleException {
        return recordSet.sort(property, desc);
    }

}
