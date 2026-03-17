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

/**
 * A service for managing several active Guacamole clients.
 */
angular.module('client').factory('guacClientManager', ['$injector',
        function guacClientManager($injector) {

    // Required types
    const ManagedClient      = $injector.get('ManagedClient');
    const ManagedClientGroup = $injector.get('ManagedClientGroup');

    // Required services
    const $window               = $injector.get('$window');
    const sessionStorageFactory = $injector.get('sessionStorageFactory');

    var service = {};

    /**
     * Getter/setter which retrieves or sets the map of all active managed
     * clients. Each key is the ID of the connection used by that client.
     *
     * @type Function
     */
    var storedManagedClients = sessionStorageFactory.create({}, function destroyClientStorage() {

        // Disconnect all clients when storage is destroyed
        service.clear();

    });

    /**
     * Returns a map of all active managed clients. Each key is the ID of the
     * connection used by that client.
     *
     * @returns {Object.<String, ManagedClient>}
     *     A map of all active managed clients.
     */
    service.getManagedClients = function getManagedClients() {
        return storedManagedClients();
    };

    /**
     * Getter/setter which retrieves or sets the array of all active managed
     * client groups.
     *
     * @type Function
     */
    const storedManagedClientGroups = sessionStorageFactory.create([], function destroyClientGroupStorage() {

        // Disconnect all clients when storage is destroyed
        service.clear();

    });

    /**
     * Returns an array of all managed client groups.
     *
     * @returns {ManagedClientGroup[]>}
     *     An array of all active managed client groups.
     */
    service.getManagedClientGroups = function getManagedClientGroups() {
        return storedManagedClientGroups();
    };

    /**
     * Removes the ManagedClient with the given ID from all
     * ManagedClientGroups, automatically adjusting the tile size of the
     * clients that remain in each group. All client groups that are empty
     * after the client is removed will also be removed.
     *
     * @param {string} id
     *     The ID of the ManagedClient to remove.
     */
    const ungroupManagedClient = function ungroupManagedClient(id) {

        const managedClientGroups = storedManagedClientGroups();

        // Remove client from all groups
        managedClientGroups.forEach(group => {
            const removed = _.remove(group.clients, client => (client.id === id));
            if (removed.length) {

                // Reset focus state if client is being removed from a group
                // that isn't currently attached (focus may otherwise be
                // retained and result in a newly added connection unexpectedly
                // sharing focus)
                if (!group.attached)
                    removed.forEach(client => { client.clientProperties.focused = false; });

                // Recalculate group grid if number of clients is changing
                ManagedClientGroup.recalculateTiles(group);

            }
        });

        // Remove any groups that are now empty
        _.remove(managedClientGroups, group => !group.clients.length);

    };

    /**
     * Removes the existing ManagedClient associated with the connection having
     * the given ID, if any. If no such a ManagedClient already exists, this
     * function has no effect.
     *
     * @param {String} id
     *     The ID of the connection whose ManagedClient should be removed.
     * 
     * @returns {Boolean}
     *     true if an existing client was removed, false otherwise.
     */
    service.removeManagedClient = function removeManagedClient(id) {
        
        var managedClients = storedManagedClients();

        // Remove client if it exists
        if (id in managedClients) {

            // Pull client out of any containing groups
            ungroupManagedClient(id);

            // Disconnect and remove
            managedClients[id].client.disconnect();
            delete managedClients[id];

            // A client was removed
            return true;

        }

        // No client was removed
        return false;

    };

    /**
     * Creates a new ManagedClient associated with the connection having the
     * given ID. If such a ManagedClient already exists, it is disconnected and
     * replaced.
     *
     * @param {String} id
     *     The ID of the connection whose ManagedClient should be retrieved.
     *     
     * @returns {ManagedClient}
     *     The ManagedClient associated with the connection having the given
     *     ID.
     */
    service.replaceManagedClient = function replaceManagedClient(id) {

        const managedClients = storedManagedClients();
        const managedClientGroups = storedManagedClientGroups();

        // Remove client if it exists
        if (id in managedClients) {

            const hadFocus = managedClients[id].clientProperties.focused;
            managedClients[id].client.disconnect();
            delete managedClients[id];
            
            // Remove client from all groups
            managedClientGroups.forEach(group => {

                const index = _.findIndex(group.clients, client => (client.id === id));
                if (index === -1)
                    return;

                group.clients[index] = managedClients[id] = ManagedClient.getInstance(id);
                managedClients[id].clientProperties.focused = hadFocus;

            });

        }

        return managedClients[id];

    };

    /**
     * Returns the ManagedClient associated with the connection having the
     * given ID. If no such ManagedClient exists, a new ManagedClient is
     * created.
     *
     * @param {String} id
     *     The ID of the connection whose ManagedClient should be retrieved.
     *     
     * @returns {ManagedClient}
     *     The ManagedClient associated with the connection having the given
     *     ID.
     */
    service.getManagedClient = function getManagedClient(id) {

        var managedClients = storedManagedClients();

        // Ensure any existing client is removed from its containing group
        // prior to being returned
        ungroupManagedClient(id);

        // Create new managed client if it doesn't already exist
        if (!(id in managedClients))
            managedClients[id] = ManagedClient.getInstance(id);

        // Return existing client
        return managedClients[id];

    };

    /**
     * Returns the ManagedClientGroup having the given ID. If no such
     * ManagedClientGroup exists, a new ManagedClientGroup is created by
     * extracting the relevant connections from the ID.
     *
     * @param {String} id
     *     The ID of the ManagedClientGroup to retrieve or create.
     *
     * @returns {ManagedClientGroup}
     *     The ManagedClientGroup having the given ID.
     */
    service.getManagedClientGroup = function getManagedClientGroup(id) {

        const managedClientGroups = storedManagedClientGroups();
        const existingGroup = _.find(managedClientGroups, (group) => {
            return id === ManagedClientGroup.getIdentifier(group);
        });

        // Prefer to return the existing group if it exactly matches
        if (existingGroup)
            return existingGroup;

        const clients = [];
        const clientIds = ManagedClientGroup.getClientIdentifiers(id);

        // Separate active clients by whether they should be displayed within
        // the current view
        clientIds.forEach(function groupClients(id) {
            clients.push(service.getManagedClient(id));
        });

        const group = new ManagedClientGroup({
            clients : clients
        });

        // Focus the first client if there are no clients focused
        ManagedClientGroup.verifyFocus(group);

        managedClientGroups.push(group);
        return group;

    };

    /**
     * Removes the existing ManagedClientGroup having the given ID, if any,
     * disconnecting and removing all ManagedClients associated with that
     * group. If no such a ManagedClientGroup currently exists, this function
     * has no effect.
     *
     * @param {String} id
     *     The ID of the ManagedClientGroup to remove.
     * 
     * @returns {Boolean}
     *     true if a ManagedClientGroup was removed, false otherwise.
     */
    service.removeManagedClientGroup = function removeManagedClientGroup(id) {

        const managedClients = storedManagedClients();
        const managedClientGroups = storedManagedClientGroups();

        // Remove all matching groups (there SHOULD only be one)
        const removed = _.remove(managedClientGroups, (group) => ManagedClientGroup.getIdentifier(group) === id);

        // Disconnect all clients associated with the removed group(s)
        removed.forEach((group) => {
            group.clients.forEach((client) => {

                const id = client.id;
                if (managedClients[id]) {
                    managedClients[id].client.disconnect();
                    delete managedClients[id];
                }

            });
        });

        return !!removed.length;

    };

    /**
     * Disconnects and removes all currently-connected clients and client
     * groups.
     */
    service.clear = function clear() {

        var managedClients = storedManagedClients();

        // Disconnect each managed client
        for (var id in managedClients)
            managedClients[id].client.disconnect();

        // Clear managed clients and client groups
        storedManagedClients({});
        storedManagedClientGroups([]);

    };

    // Disconnect all clients when window is unloaded
    $window.addEventListener('unload', service.clear);

    return service;

}]);
