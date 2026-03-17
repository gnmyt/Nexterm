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

package org.apache.guacamole.auth.jdbc.sharing.permission;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.simple.SimpleObjectPermissionSet;

/**
 * An immutable ObjectPermissionSet which defines only READ permissions for a
 * fixed set of identifiers.
 */
public class SharedObjectPermissionSet extends SimpleObjectPermissionSet {

    /**
     * Returns a new Set of ObjectPermissions defining READ access for each of
     * the given identifiers.
     *
     * @param identifiers
     *     The identifiers of the objects for which READ permission should be
     *     granted.
     *
     * @return
     *     A new Set of ObjectPermissions granting READ access for each of the
     *     given identifiers.
     */
    private static Set<ObjectPermission> getPermissions(Collection<String> identifiers) {

        // Include one READ permission for each of the given identifiers
        Set<ObjectPermission> permissions = new HashSet<ObjectPermission>();
        for (String identifier : identifiers)
            permissions.add(new ObjectPermission(ObjectPermission.Type.READ, identifier));

        return permissions;

    }

    /**
     * Creates a new SharedObjectPermissionSet which grants read-only access to
     * the objects having the given identifiers. No other permissions are
     * granted.
     *
     * @param identifiers
     *     The identifiers of the objects for which READ access should be
     *     granted.
     */
    public SharedObjectPermissionSet(Collection<String> identifiers) {
        super(getPermissions(identifiers));
    }

}
