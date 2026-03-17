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

package org.apache.guacamole.net.auth.simple;

import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.ActivityRecordSet.SortableProperty;

/**
 * An immutable and empty ActivityRecordSet.
 *
 * @param <RecordType>
 *     The type of ActivityRecord contained within this set.
 */
public class SimpleActivityRecordSet<RecordType extends ActivityRecord>
        implements ActivityRecordSet<RecordType> {

    /**
     * The records associated with this record set, if any.
     */
    private final Collection<RecordType> records;
    
    /**
     * Create a new SimpleActivityRecordSet that contains an empty set of
     * records.
     */
    public SimpleActivityRecordSet() {
        records = Collections.emptyList();
    }
    
    /**
     * Create a new SimpleActivityRecordSet that contains the provided records
     * which will back this record set.
     * 
     * @param records 
     *     The records that this SimpleActivityRecordSet should contain.
     */
    public SimpleActivityRecordSet(Collection<? extends RecordType> records) {
        this.records = Collections.unmodifiableCollection(records);
    }
    
    @Override
    public Collection<RecordType> asCollection()
            throws GuacamoleException {
        return records;
    }

    @Override
    public ActivityRecordSet<RecordType> contains(String value)
            throws GuacamoleException {
        return this;
    }

    @Override
    public ActivityRecordSet<RecordType> limit(int limit)
            throws GuacamoleException {
        return this;
    }

    @Override
    public ActivityRecordSet<RecordType> sort(SortableProperty property,
            boolean desc) throws GuacamoleException {
        return this;
    }

}
