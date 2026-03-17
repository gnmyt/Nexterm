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
import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.properties.CaseSensitivity;

/**
 * A database implementation of RelatedObjectSet which provides access to a
 * parent object and corresponding set of objects related to the parent, subject
 * to object-level permissions. Though the parent and child objects have
 * specific types, only the parent object's type is enforced through type
 * parameters, as child objects are represented by identifiers only.
 *
 * @param <ParentObjectType>
 *     The type of object that represents the parent side of the relation.
 *
 * @param <ParentModelType>
 *     The underlying database model of the parent object.
 */
public abstract class RelatedObjectSet<ParentObjectType extends ModeledDirectoryObject<ParentModelType>, ParentModelType extends ObjectModel>
        extends RestrictedObject implements org.apache.guacamole.net.auth.RelatedObjectSet {

    /**
     * The parent object which shares some arbitrary relation with the objects
     * within this set.
     */
    private ParentObjectType parent;

    /**
     * Creates a new RelatedObjectSet. The resulting object set must still be
     * initialized by a call to init().
     */
    public RelatedObjectSet() {
    }

    /**
     * Initializes this RelatedObjectSet with the current user and the single
     * object on the parent side of the one-to-many relation represented by the
     * set.
     *
     * @param currentUser
     *     The user who queried this RelatedObjectSet, and whose permissions
     *     dictate the access level of all operations performed on this set.
     *
     * @param parent
     *     The parent object which shares some arbitrary relation with the
     *     objects within this set.
     */
    public void init(ModeledAuthenticatedUser currentUser, ParentObjectType parent) {
        super.init(currentUser);
        this.parent = parent;
    }

    /**
     * Return the current case sensitivity setting, which can be used to
     * determine whether or not certain identifiers should be treated as
     * case-sensitive.
     * 
     * @return
     *     The current case sensitivity setting.
     * 
     * @throws GuacamoleException 
     *     If an error occurs retrieving configuration information on
     *     case sensitivity.
     */
    protected CaseSensitivity getCaseSensitivity() throws GuacamoleException {
        
        // Identifiers are not case-sensitive by default.
        return CaseSensitivity.DISABLED;
    }
    
    /**
     * Returns the mapper which provides low-level access to the database
     * models which drive the relation represented by this RelatedObjectSet.
     *
     * @return
     *     The mapper which provides low-level access to the database
     *     models which drive the relation represented by this
     *     RelatedObjectSet.
     */
    protected abstract ObjectRelationMapper<ParentModelType> getObjectRelationMapper();

    /**
     * Returns the permission set which exposes the effective permissions
     * available to the current user regarding the objects on the parent side
     * of the one-to-many relationship represented by this RelatedObjectSet.
     * Permission inheritance through user groups is taken into account.
     *
     * @return
     *     The permission set which exposes the effective permissions
     *     available to the current user regarding the objects on the parent
     *     side of the one-to-many relationship represented by this
     *     RelatedObjectSet.
     *
     * @throws GuacamoleException
     *     If permission to query permission status is denied.
     */
    protected abstract ObjectPermissionSet getParentObjectEffectivePermissionSet()
            throws GuacamoleException;

    /**
     * Returns the permission set which exposes the effective permissions
     * available to the current user regarding the objects on the child side
     * of the one-to-many relationship represented by this RelatedObjectSet.
     * Permission inheritance through user groups is taken into account.
     *
     * @return
     *     The permission set which exposes the effective permissions
     *     available to the current user regarding the objects on the child
     *     side of the one-to-many relationship represented by this
     *     RelatedObjectSet.
     *
     * @throws GuacamoleException
     *     If permission to query permission status is denied.
     */
    protected abstract ObjectPermissionSet getChildObjectEffectivePermissionSet()
            throws GuacamoleException;

    /**
     * Returns whether the current user has permission to alter the status of
     * the relation between the parent object and the given child objects.
     *
     * @param identifiers
     *     The identifiers of all objects on the child side of the one-to-many
     *     relation being changed.
     *
     * @return
     *     true if the user has permission to make the described changes,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If permission to query permission status is denied.
     */
    private boolean canAlterRelation(Collection<String> identifiers)
            throws GuacamoleException {

        // Privileged users (such as system administrators) may alter any
        // relations
        if (getCurrentUser().isPrivileged())
            return true;

        // Non-admin users require UPDATE permission on the parent object ...
        if (!getParentObjectEffectivePermissionSet().hasPermission(
                ObjectPermission.Type.UPDATE, parent.getIdentifier()))
            return false;

        // ... as well as UPDATE permission on all child objects being changed
        Collection<String> accessibleIdentifiers =
                getChildObjectEffectivePermissionSet().getAccessibleObjects(
                        Collections.singleton(ObjectPermission.Type.UPDATE),
                        identifiers);

        return accessibleIdentifiers.size() == identifiers.size();

    }

    @Override
    public Set<String> getObjects() throws GuacamoleException {

        // Bypass permission checks if the user is a privileged
        ModeledAuthenticatedUser user = getCurrentUser();
        if (user.isPrivileged())
            return getObjectRelationMapper().selectChildIdentifiers(parent.getModel());

        // Otherwise only return explicitly readable identifiers
        return getObjectRelationMapper().selectReadableChildIdentifiers(
                user.getUser().getModel(), user.getEffectiveUserGroups(),
                getCaseSensitivity(),
                parent.getModel());

    }

    @Override
    public void addObjects(Set<String> identifiers) throws GuacamoleException {

        // Nothing to do if nothing provided
        if (identifiers.isEmpty())
            return;

        // Create relations only if permission is granted
        if (canAlterRelation(identifiers))
            getObjectRelationMapper().insert(parent.getModel(), identifiers,
                    getCaseSensitivity());

        // User lacks permission to add user groups
        else
            throw new GuacamoleSecurityException("Permission denied.");

    }

    @Override
    public void removeObjects(Set<String> identifiers) throws GuacamoleException {

        // Nothing to do if nothing provided
        if (identifiers.isEmpty())
            return;

        // Delete relations only if permission is granted
        if (canAlterRelation(identifiers))
            getObjectRelationMapper().delete(parent.getModel(), identifiers,
                    getCaseSensitivity());

        // User lacks permission to remove user groups
        else
            throw new GuacamoleSecurityException("Permission denied.");

    }

}
