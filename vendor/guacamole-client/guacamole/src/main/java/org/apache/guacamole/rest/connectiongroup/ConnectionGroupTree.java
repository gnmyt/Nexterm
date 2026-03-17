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

package org.apache.guacamole.rest.connectiongroup;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.rest.connection.APIConnection;
import org.apache.guacamole.rest.sharingprofile.APISharingProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provides access to the entire tree of connection groups, their
 * connections, and any associated sharing profiles.
 */
public class ConnectionGroupTree {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ConnectionGroupTree.class);

    /**
     * The root connection group as an APIConnectionGroup.
     */
    private final APIConnectionGroup rootAPIGroup;

    /**
     * All connection permissions granted to the user obtaining this tree.
     */
    private final ObjectPermissionSet connectionPermissions;

    /**
     * All sharing profile permissions granted to the user obtaining this tree.
     */
    private final ObjectPermissionSet sharingProfilePermissions;

    /**
     * The directory of all connections visible to the user obtaining this tree.
     */
    private final Directory<Connection> connectionDirectory;

    /**
     * The directory of all connection groups visible to the user obtaining this
     * tree.
     */
    private final Directory<ConnectionGroup> connectionGroupDirectory;

    /**
     * The directory of all sharing profiles visible to the user obtaining this
     * tree.
     */
    private final Directory<SharingProfile> sharingProfileDirectory;

    /**
     * All connection groups that have been retrieved, stored by their
     * identifiers.
     */
    private final Map<String, APIConnectionGroup> retrievedGroups =
            new HashMap<String, APIConnectionGroup>();

    /**
     * All connections that have been retrieved, stored by their identifiers.
     */
    private final Map<String, APIConnection> retrievedConnections =
            new HashMap<String, APIConnection>();

    /**
     * Adds each of the provided connections to the current tree as children
     * of their respective parents. The parent connection groups must already
     * be added.
     *
     * @param connections
     *     The connections to add to the tree.
     * 
     * @throws GuacamoleException
     *     If an error occurs while adding the connection to the tree.
     */
    private void addConnections(Collection<Connection> connections)
        throws GuacamoleException {

        // Add each connection to the tree
        for (Connection connection : connections) {

            // Retrieve the connection's parent group
            APIConnectionGroup parent = retrievedGroups.get(connection.getParentIdentifier());
            if (parent != null) {

                Collection<APIConnection> children = parent.getChildConnections();
                
                // Create child collection if it does not yet exist
                if (children == null) {
                    children = new ArrayList<APIConnection>();
                    parent.setChildConnections(children);
                }

                // Add child
                APIConnection apiConnection = new APIConnection(connection);
                retrievedConnections.put(connection.getIdentifier(), apiConnection);
                children.add(apiConnection);
                
            }

            // Warn of internal consistency issues
            else
                logger.debug("Connection \"{}\" cannot be added to the tree: parent \"{}\" does not actually exist.",
                        connection.getIdentifier(),
                        connection.getParentIdentifier());

        } // end for each connection
        
    }
    
    /**
     * Adds each of the provided connection groups to the current tree as
     * children of their respective parents. The parent connection groups must
     * already be added.
     *
     * @param connectionGroups
     *     The connection groups to add to the tree.
     */
    private void addConnectionGroups(Collection<ConnectionGroup> connectionGroups) {

        // Add each connection group to the tree
        for (ConnectionGroup connectionGroup : connectionGroups) {

            // Retrieve the connection group's parent group
            APIConnectionGroup parent = retrievedGroups.get(connectionGroup.getParentIdentifier());
            if (parent != null) {

                Collection<APIConnectionGroup> children = parent.getChildConnectionGroups();
                
                // Create child collection if it does not yet exist
                if (children == null) {
                    children = new ArrayList<APIConnectionGroup>();
                    parent.setChildConnectionGroups(children);
                }

                // Add child
                APIConnectionGroup apiConnectionGroup = new APIConnectionGroup(connectionGroup);
                retrievedGroups.put(connectionGroup.getIdentifier(), apiConnectionGroup);
                children.add(apiConnectionGroup);
                
            }

            // Warn of internal consistency issues
            else
                logger.debug("Connection group \"{}\" cannot be added to the tree: parent \"{}\" does not actually exist.",
                        connectionGroup.getIdentifier(),
                        connectionGroup.getParentIdentifier());

        } // end for each connection group
        
    }

    /**
     * Adds each of the provided sharing profiles to the current tree as
     * children of their respective primary connections. The primary connections
     * must already be added.
     *
     * @param sharingProfiles
     *     The sharing profiles to add to the tree.
     *
     * @throws GuacamoleException
     *     If an error occurs while adding the sharing profiles to the tree.
     */
    private void addSharingProfiles(Collection<SharingProfile> sharingProfiles)
        throws GuacamoleException {

        // Add each sharing profile to the tree
        for (SharingProfile sharingProfile : sharingProfiles) {

            // Retrieve the sharing profile's associated connection
            String primaryConnectionIdentifier = sharingProfile.getPrimaryConnectionIdentifier();
            APIConnection primaryConnection = retrievedConnections.get(primaryConnectionIdentifier);

            // Add the sharing profile as a child of the primary connection
            if (primaryConnection != null) {

                Collection<APISharingProfile> children = primaryConnection.getSharingProfiles();

                // Create child collection if it does not yet exist
                if (children == null) {
                    children = new ArrayList<APISharingProfile>();
                    primaryConnection.setSharingProfiles(children);
                }

                // Add child
                children.add(new APISharingProfile(sharingProfile));

            }

            // Warn of internal consistency issues
            else
                logger.debug("Sharing profile \"{}\" cannot be added to the "
                        + "tree: primary connection \"{}\" does not actually "
                        + "exist.", sharingProfile.getIdentifier(),
                        primaryConnectionIdentifier);

        } // end for each sharing profile

    }

    /**
     * Adds all descendants of the given parent groups to their corresponding
     * parents already stored under root.
     *
     * @param parents
     *     The parents whose descendants should be added to the tree.
     * 
     * @param permissions
     *     If specified and non-empty, limit added connections to only
     *     connections for which the current user has any of the given
     *     permissions. Otherwise, all visible connections are added.
     *     Connection groups are unaffected by this parameter.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the descendants.
     */
    private void addConnectionGroupDescendants(Collection<ConnectionGroup> parents,
            List<ObjectPermission.Type> permissions)
        throws GuacamoleException {

        // If no parents, nothing to do
        if (parents.isEmpty())
            return;

        Collection<String> childConnectionIdentifiers = new ArrayList<String>();
        Collection<String> childConnectionGroupIdentifiers = new ArrayList<String>();
        
        // Build lists of identifiers for retrieval
        for (ConnectionGroup parent : parents) {
            childConnectionIdentifiers.addAll(parent.getConnectionIdentifiers());
            childConnectionGroupIdentifiers.addAll(parent.getConnectionGroupIdentifiers());
        }

        // Filter identifiers based on permissions, if requested
        if (permissions != null && !permissions.isEmpty())
            childConnectionIdentifiers = connectionPermissions.getAccessibleObjects(
                    permissions, childConnectionIdentifiers);
        
        // Retrieve child connections
        if (!childConnectionIdentifiers.isEmpty()) {
            Collection<Connection> childConnections = connectionDirectory.getAll(childConnectionIdentifiers);
            addConnections(childConnections);
            addConnectionDescendants(childConnections, permissions);
        }

        // Retrieve child connection groups
        if (!childConnectionGroupIdentifiers.isEmpty()) {
            Collection<ConnectionGroup> childConnectionGroups = connectionGroupDirectory.getAll(childConnectionGroupIdentifiers);
            addConnectionGroups(childConnectionGroups);
            addConnectionGroupDescendants(childConnectionGroups, permissions);
        }

    }

    /**
     * Adds all descendant sharing profiles of the given connections to their
     * corresponding primary connections already stored under root.
     *
     * @param connections
     *     The connections whose descendant sharing profiles should be added to
     *     the tree.
     *
     * @param permissions
     *     If specified and non-empty, limit added sharing profiles to only
     *     those for which the current user has any of the given
     *     permissions. Otherwise, all visible sharing profiles are added.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the descendants.
     */
    private void addConnectionDescendants(Collection<Connection> connections,
            List<ObjectPermission.Type> permissions)
        throws GuacamoleException {

        // If no connections, nothing to do
        if (connections.isEmpty())
            return;

        // Build lists of sharing profile identifiers for retrieval
        Collection<String> identifiers = new ArrayList<String>();
        for (Connection connection : connections)
            identifiers.addAll(connection.getSharingProfileIdentifiers());

        // Filter identifiers based on permissions, if requested
        if (permissions != null && !permissions.isEmpty())
            identifiers = sharingProfilePermissions.getAccessibleObjects(
                    permissions, identifiers);

        // Retrieve and add all associated sharing profiles
        if (!identifiers.isEmpty()) {
            Collection<SharingProfile> sharingProfiles = sharingProfileDirectory.getAll(identifiers);
            addSharingProfiles(sharingProfiles);
        }

    }
    
    /**
     * Creates a new connection group tree using the given connection group as
     * the tree root.
     *
     * @param userContext
     *     The context of the user obtaining the connection group tree.
     *
     * @param root
     *     The connection group to use as the root of this connection group
     *     tree.
     * 
     * @param permissions
     *     If specified and non-empty, limit the contents of the tree to only
     *     those connections for which the current user has any of the given
     *     permissions. Otherwise, all visible connections are returned.
     *     Connection groups are unaffected by this parameter.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the tree of connection groups
     *     and their descendants.
     */
    public ConnectionGroupTree(UserContext userContext, ConnectionGroup root,
            List<ObjectPermission.Type> permissions) throws GuacamoleException {

        // Store root of tree
        this.rootAPIGroup = new APIConnectionGroup(root);
        retrievedGroups.put(root.getIdentifier(), this.rootAPIGroup);

        // Store user's current permissions
        Permissions effective = userContext.self().getEffectivePermissions();
        this.connectionPermissions = effective.getConnectionPermissions();
        this.sharingProfilePermissions = effective.getSharingProfilePermissions();

        // Store required directories
        this.connectionDirectory = userContext.getConnectionDirectory();
        this.connectionGroupDirectory = userContext.getConnectionGroupDirectory();
        this.sharingProfileDirectory = userContext.getSharingProfileDirectory();

        // Add all descendants
        addConnectionGroupDescendants(Collections.singleton(root), permissions);
        
    }

    /**
     * Returns the entire connection group tree as an APIConnectionGroup. The
     * returned APIConnectionGroup is the root group and will contain all
     * descendant connection groups and connections, arranged hierarchically.
     *
     * @return
     *     The root connection group, containing the entire connection group
     *     tree and all connections.
     */
    public APIConnectionGroup getRootAPIConnectionGroup() {
        return rootAPIGroup;
    }

}
