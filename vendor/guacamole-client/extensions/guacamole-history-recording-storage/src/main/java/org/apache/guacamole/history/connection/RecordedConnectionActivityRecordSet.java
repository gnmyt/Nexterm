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

package org.apache.guacamole.history.connection;

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.DecoratingActivityRecordSet;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.SystemPermission;

/**
 * ActivityRecordSet implementation that automatically defines ActivityLogs for
 * files that relate to history entries within the wrapped set.
 */
public class RecordedConnectionActivityRecordSet extends DecoratingActivityRecordSet<ConnectionRecord> {

    /**
     * Whether the current user is an administrator.
     */
    private final boolean isAdmin;

    /**
     * The overall set of connection permissions defined for the current user.
     */
    private final Set<ObjectPermission> connectionPermissions;

    /**
     * Creates a new RecordedConnectionActivityRecordSet that wraps the given
     * ActivityRecordSet, automatically associating history entries with
     * ActivityLogs based on related files (session recordings, typescripts,
     * etc.).
     *
     * @param currentUser
     *     The current Guacamole user.
     *
     * @param activityRecordSet
     *     The ActivityRecordSet to wrap.
     *
     * @throws GuacamoleException
     *     If the permissions for the current user cannot be retrieved.
     */
    public RecordedConnectionActivityRecordSet(User currentUser,
            ActivityRecordSet<ConnectionRecord> activityRecordSet)
            throws GuacamoleException {
        super(activityRecordSet);

        // Determine whether current user is an administrator
        Permissions perms = currentUser.getEffectivePermissions();
        isAdmin = perms.getSystemPermissions().hasPermission(SystemPermission.Type.ADMINISTER);

        // If not an admin, additionally pull specific connection permissions
        if (isAdmin)
            connectionPermissions = Collections.emptySet();
        else
            connectionPermissions = perms.getConnectionPermissions().getPermissions();

    }

    /**
     * Returns whether the current user has permission to view the logs
     * associated with the given history record. It is already given that the
     * user has permission to view the history record itself. This extension
     * considers a user to have permission to view history logs if they are
     * an administrator or if they have permission to edit the associated
     * connection.
     *
     * @param record
     *     The record to check.
     *
     * @return
     *     true if the current user has permission to view the logs associated
     *     with the given record, false otherwise.
     */
    private boolean canViewLogs(ConnectionRecord record) {

        // Administrator can always view
        if (isAdmin)
            return true;

        // Non-administrator CANNOT view if permissions cannot be verified
        String identifier = record.getConnectionIdentifier();
        if (identifier == null)
            return false;

        // Non-administer can only view if they implicitly have permission to
        // configure recordings (they have permission to edit)
        ObjectPermission canUpdate = new ObjectPermission(ObjectPermission.Type.UPDATE, identifier);
        return connectionPermissions.contains(canUpdate);

    }

    @Override
    protected ConnectionRecord decorate(ConnectionRecord record) throws GuacamoleException {

        // Provide access to logs only if permission is granted
        if (canViewLogs(record))
            return new HistoryConnectionRecord(record);

        return record;

    }

}
