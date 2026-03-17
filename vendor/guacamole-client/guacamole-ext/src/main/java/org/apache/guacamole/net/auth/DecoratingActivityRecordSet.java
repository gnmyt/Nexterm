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

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.apache.guacamole.GuacamoleException;

/**
 * ActivityRecordSet implementation which simplifies decorating the records
 * within an underlying ActivityRecordSet. The decorate() function must be
 * implemented to define how each record is decorated. As ActivityRecordSets
 * are read-only, there is no need to define an undecorate() function as
 * required by {@link DecoratingDirectory}.
 *
 * @param <RecordType>
 *     The type of records stored within this ActivityRecordSet.
 */
public abstract class DecoratingActivityRecordSet<RecordType extends ActivityRecord>
        extends DelegatingActivityRecordSet<RecordType> {

    /**
     * Creates a new DecoratingActivityRecordSet which decorates the records
     * within the given set.
     *
     * @param recordSet
     *     The ActivityRecordSet whose records are being decorated.
     */
    public DecoratingActivityRecordSet(ActivityRecordSet<RecordType> recordSet) {
        super(recordSet);
    }

    /**
     * Given a record retrieved from a ActivityRecordSet which originates from
     * a different AuthenticationProvider, returns an identical type of record
     * optionally wrapped with additional information, functionality, etc. If
     * this record set chooses to decorate the record provided, it is up to the
     * implementation of that decorated record to properly pass through
     * operations as appropriate. All records retrieved from this
     * DecoratingActivityRecordSet will first be passed through this function.
     *
     * @param record
     *     A record from a ActivityRecordSet which originates from a different
     *     AuthenticationProvider.
     *
     * @return
     *     A record which may have been decorated by this
     *     DecoratingActivityRecordSet. If the record was not decorated, the
     *     original, unmodified record may be returned instead.
     *
     * @throws GuacamoleException
     *     If the provided record cannot be decorated due to an error.
     */
    protected abstract RecordType decorate(RecordType record)
            throws GuacamoleException;

    /**
     * Given an ActivityRecordSet which originates from a different
     * AuthenticationProvider, returns an identical type of record set
     * optionally wrapped with additional information, functionality, etc. If
     * this record set chooses to decorate the record set provided, it is up to
     * the implementation of that decorated record set to properly pass through
     * operations as appropriate. All record sets retrieved from this
     * DecoratingActivityRecordSet will first be passed through this function,
     * such as those returned by {@link #limit(int)} and similar functions.
     * <p>
     * By default, this function will wrap any provided ActivityRecordSet in a
     * simple, anonymous instance of DecoratingActivityRecordSet that delegates
     * to the decorate() implementations of this DecoratingActivityRecordSet.
     * <strong>This default behavior may need to be overridden if the
     * DecoratingActivityRecordSet implementation maintains any internal
     * state.</strong>
     *
     * @param recordSet
     *     An ActivityRecordSet which originates from a different
     *     AuthenticationProvider.
     *
     * @return
     *     A record set which may have been decorated by this
     *     DecoratingActivityRecordSet. If the record set was not decorated, the
     *     original, unmodified record set may be returned instead, however
     *     beware that this may result in records within the set no longer
     *     being decorated.
     *
     * @throws GuacamoleException
     *     If the provided record set cannot be decorated due to an error.
     */
    protected ActivityRecordSet<RecordType> decorate(ActivityRecordSet<RecordType> recordSet)
            throws GuacamoleException {
        final DecoratingActivityRecordSet<RecordType> decorator = this;
        return new DecoratingActivityRecordSet<RecordType>(recordSet) {

            @Override
            protected RecordType decorate(RecordType record) throws GuacamoleException {
                return decorator.decorate(record);
            }

            @Override
            protected ActivityRecordSet<RecordType> decorate(ActivityRecordSet<RecordType> recordSet)
                    throws GuacamoleException {
                return decorator.decorate(recordSet);
            }

        };
    }

    @Override
    public RecordType get(String string) throws GuacamoleException {

        RecordType record = super.get(string);
        if (record != null)
            return decorate(record);

        return null;

    }

    @Override
    public ActivityRecordSet<RecordType> sort(SortableProperty property,
            boolean desc) throws GuacamoleException {
        return decorate(super.sort(property, desc));
    }

    @Override
    public ActivityRecordSet<RecordType> limit(int limit) throws GuacamoleException {
        return decorate(super.limit(limit));
    }

    @Override
    public ActivityRecordSet<RecordType> contains(String value) throws GuacamoleException {
        return decorate(super.contains(value));
    }

    @Override
    public Collection<RecordType> asCollection() throws GuacamoleException {

        Collection<RecordType> records = super.asCollection();

        List<RecordType> decoratedRecords = new ArrayList<>(records.size());
        for (RecordType record : records)
            decoratedRecords.add(decorate(record));

        return decoratedRecords;

    }

}
