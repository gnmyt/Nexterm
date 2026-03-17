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
 * The controller for the page used to connect to a connection or balancing group.
 */
angular.module('client').controller('clientController', ['$scope', '$routeParams', '$injector',
        function clientController($scope, $routeParams, $injector) {

    // Required types
    const ConnectionGroup    = $injector.get('ConnectionGroup');
    const ManagedClient      = $injector.get('ManagedClient');
    const ManagedClientGroup = $injector.get('ManagedClientGroup');
    const ManagedClientState = $injector.get('ManagedClientState');
    const ManagedFilesystem  = $injector.get('ManagedFilesystem');
    const Protocol           = $injector.get('Protocol');
    const ScrollState        = $injector.get('ScrollState');

    // Required services
    const $location              = $injector.get('$location');
    const authenticationService  = $injector.get('authenticationService');
    const connectionGroupService = $injector.get('connectionGroupService');
    const clipboardService       = $injector.get('clipboardService');
    const dataSourceService      = $injector.get('dataSourceService');
    const guacClientManager      = $injector.get('guacClientManager');
    const guacFullscreen         = $injector.get('guacFullscreen');
    const iconService            = $injector.get('iconService');
    const preferenceService      = $injector.get('preferenceService');
    const requestService         = $injector.get('requestService');
    const tunnelService          = $injector.get('tunnelService');
    const userPageService        = $injector.get('userPageService');

    /**
     * The minimum number of pixels a drag gesture must move to result in the
     * menu being shown or hidden.
     *
     * @type Number
     */
    var MENU_DRAG_DELTA = 64;

    /**
     * The maximum X location of the start of a drag gesture for that gesture
     * to potentially show the menu.
     *
     * @type Number
     */
    var MENU_DRAG_MARGIN = 64;

    /**
     * When showing or hiding the menu via a drag gesture, the maximum number
     * of pixels the touch can move vertically and still affect the menu.
     * 
     * @type Number
     */
    var MENU_DRAG_VERTICAL_TOLERANCE = 10;

    /**
     * In order to open the guacamole menu, we need to hit ctrl-alt-shift. There are
     * several possible keysysms for each key.
     */
    var SHIFT_KEYS  = {0xFFE1 : true, 0xFFE2 : true},
        ALT_KEYS    = {0xFFE9 : true, 0xFFEA : true, 0xFE03 : true,
                       0xFFE7 : true, 0xFFE8 : true},
        CTRL_KEYS   = {0xFFE3 : true, 0xFFE4 : true},
        MENU_KEYS   = angular.extend({}, SHIFT_KEYS, ALT_KEYS, CTRL_KEYS);

    /**
     * Keysym for detecting any END key presses, for the purpose of passing through
     * the Ctrl-Alt-Del sequence to a remote system.
     */
    var END_KEYS = {0xFF57 : true, 0xFFB1 : true};

    /**
     * Keysym for sending the DELETE key when the Ctrl-Alt-End hotkey
     * combo is pressed.
     *
     * @type Number
     */
    var DEL_KEY = 0xFFFF;

    /**
     * Menu-specific properties.
     */
    $scope.menu = {

        /**
         * Whether the menu is currently shown.
         *
         * @type Boolean
         */
        shown : false,

        /**
         * The currently selected input method. This may be any of the values
         * defined within preferenceService.inputMethods.
         *
         * @type String
         */
        inputMethod : preferenceService.preferences.inputMethod,

        /**
         * Whether translation of touch to mouse events should emulate an
         * absolute pointer device, or a relative pointer device.
         *
         * @type Boolean
         */
        emulateAbsoluteMouse : preferenceService.preferences.emulateAbsoluteMouse,

        /**
         * The current scroll state of the menu.
         *
         * @type ScrollState
         */
        scrollState : new ScrollState(),

        /**
         * The current desired values of all editable connection parameters as
         * a set of name/value pairs, including any changes made by the user.
         *
         * @type {Object.<String, String>}
         */
        connectionParameters : {}

    };

    // Convenience method for closing the menu
    $scope.closeMenu = function closeMenu() {
        $scope.menu.shown = false;
    };

    /**
     * Applies any changes to connection parameters made by the user within the
     * Guacamole menu to the given ManagedClient. If no client is supplied,
     * this function has no effect.
     *
     * @param {ManagedClient} client
     *     The client to apply parameter changes to.
     */
    $scope.applyParameterChanges = function applyParameterChanges(client) {
        angular.forEach($scope.menu.connectionParameters, function sendArgv(value, name) {
            if (client)
                ManagedClient.setArgument(client, name, value);
        });
    };

    /**
     * The currently-focused client within the current ManagedClientGroup. If
     * there is no current group, no client is focused, or multiple clients are
     * focused, this will be null.
     *
     * @type ManagedClient
     */
    $scope.focusedClient = null;

    /**
     * The set of clients that should be attached to the client UI. This will
     * be immediately initialized by a call to updateAttachedClients() below.
     *
     * @type ManagedClientGroup
     */
    $scope.clientGroup = null;

    /**
     * @borrows ManagedClientGroup.getName
     */
    $scope.getName = ManagedClientGroup.getName;

    /**
     * @borrows ManagedClientGroup.getTitle
     */
    $scope.getTitle = ManagedClientGroup.getTitle;

    /**
     * Arbitrary context that should be exposed to the guacGroupList directive
     * displaying the dropdown list of available connections within the
     * Guacamole menu.
     */
    $scope.connectionListContext = {

        /**
         * The set of clients desired within the current view. For each client
         * that should be present within the current view, that client's ID
         * will map to "true" here.
         *
         * @type {Object.<string, boolean>}
         */
        attachedClients : {},

        /**
         * Notifies that the client with the given ID has been added or
         * removed from the set of clients desired within the current view,
         * and the current view should be updated accordingly.
         *
         * @param {string} id
         *     The ID of the client that was added or removed from the current
         *     view.
         */
        updateAttachedClients : function updateAttachedClients(id) {
            $scope.addRemoveClient(id, !$scope.connectionListContext.attachedClients[id]);
        }

    };

    /**
     * Adds or removes the client with the given ID from the set of clients
     * within the current view, updating the current URL accordingly.
     *
     * @param {string} id
     *     The ID of the client to add or remove from the current view.
     *
     * @param {boolean} [remove=false]
     *     Whether the specified client should be added (false) or removed
     *     (true).
     */
    $scope.addRemoveClient = function addRemoveClient(id, remove) {

        // Deconstruct current path into corresponding client IDs
        const ids = ManagedClientGroup.getClientIdentifiers($routeParams.id);

        // Add/remove ID as requested
        if (remove)
            _.pull(ids, id);
        else
            ids.push(id);

        // Reconstruct path, updating attached clients via change in route
        $location.path('/client/' + ManagedClientGroup.getIdentifier(ids));

    };

    /**
     * Reloads the contents of $scope.clientGroup to reflect the client IDs
     * currently listed in the URL.
     */
    const reparseRoute = function reparseRoute() {

        const previousClients = $scope.clientGroup ? $scope.clientGroup.clients.slice() : [];

        // Replace existing group with new group
        setAttachedGroup(guacClientManager.getManagedClientGroup($routeParams.id));

        // Store current set of attached clients for later use within the
        // Guacamole menu
        $scope.connectionListContext.attachedClients = {};
        $scope.clientGroup.clients.forEach((client) => {
            $scope.connectionListContext.attachedClients[client.id] = true;
        });

        // Ensure menu is closed if updated view is not a modification of the
        // current view (has no clients in common). The menu should remain open
        // only while the current view is being modified, not when navigating
        // to an entirely different view.
        if (_.isEmpty(_.intersection(previousClients, $scope.clientGroup.clients)))
            $scope.menu.shown = false;

        // Update newly-attached clients with current contents of clipboard
        clipboardService.resyncClipboard();

    };

    /**
     * Replaces the ManagedClientGroup currently attached to the client
     * interface via $scope.clientGroup with the given ManagedClientGroup,
     * safely cleaning up after the previous group. If no ManagedClientGroup is
     * provided, the existing group is simply removed.
     *
     * @param {ManagedClientGroup} [managedClientGroup]
     *     The ManagedClientGroup to attach to the interface, if any.
     */
    const setAttachedGroup = function setAttachedGroup(managedClientGroup) {

        // Do nothing if group is not actually changing
        if ($scope.clientGroup === managedClientGroup)
            return;

        if ($scope.clientGroup) {

            // Remove all disconnected clients from management (the user has
            // seen their status)
            _.filter($scope.clientGroup.clients, client => {

                const connectionState = client.clientState.connectionState;
                return connectionState === ManagedClientState.ConnectionState.DISCONNECTED
                 || connectionState === ManagedClientState.ConnectionState.TUNNEL_ERROR
                 || connectionState === ManagedClientState.ConnectionState.CLIENT_ERROR;

            }).forEach(client => {
                guacClientManager.removeManagedClient(client.id);
            });

            // Flag group as detached
            $scope.clientGroup.attached = false;

        }

        if (managedClientGroup) {
            $scope.clientGroup = managedClientGroup;
            $scope.clientGroup.attached = true;
            $scope.clientGroup.lastUsed = new Date().getTime();
        }

    };

    // Init sets of clients based on current URL ...
    reparseRoute();

    // ... and re-initialize those sets if the URL has changed without
    // reloading the route
    $scope.$on('$routeUpdate', reparseRoute);

    /**
     * The root connection groups of the connection hierarchy that should be
     * presented to the user for selecting a different connection, as a map of
     * data source identifier to the root connection group of that data
     * source. This will be null if the connection group hierarchy has not yet
     * been loaded or if the hierarchy is inapplicable due to only one
     * connection or balancing group being available.
     *
     * @type Object.<String, ConnectionGroup>
     */
    $scope.rootConnectionGroups = null;

    /**
     * Array of all connection properties that are filterable.
     *
     * @type String[]
     */
    $scope.filteredConnectionProperties = [
        'name'
    ];

    /**
     * Array of all connection group properties that are filterable.
     *
     * @type String[]
     */
    $scope.filteredConnectionGroupProperties = [
        'name'
    ];

    // Retrieve root groups and all descendants
    dataSourceService.apply(
        connectionGroupService.getConnectionGroupTree,
        authenticationService.getAvailableDataSources(),
        ConnectionGroup.ROOT_IDENTIFIER
    )
    .then(function rootGroupsRetrieved(rootConnectionGroups) {

        // Store retrieved groups only if there are multiple connections or
        // balancing groups available
        var clientPages = userPageService.getClientPages(rootConnectionGroups);
        if (clientPages.length > 1)
            $scope.rootConnectionGroups = rootConnectionGroups;

    }, requestService.WARN);

    /**
     * Map of all available sharing profiles for the current connection by
     * their identifiers. If this information is not yet available, or no such
     * sharing profiles exist, this will be an empty object.
     *
     * @type Object.<String, SharingProfile>
     */
    $scope.sharingProfiles = {};

    /**
     * Map of all substituted key presses.  If one key is pressed in place of another
     * the value of the substituted key is stored in an object with the keysym of
     * the original key.
     *
     * @type Object.<Number, Number>
     */
    var substituteKeysPressed = {};

    /**
     * Returns whether the shortcut for showing/hiding the Guacamole menu
     * (Ctrl+Alt+Shift) has been pressed.
     *
     * @param {Guacamole.Keyboard} keyboard
     *     The Guacamole.Keyboard object tracking the local keyboard state.
     *
     * @returns {boolean}
     *     true if Ctrl+Alt+Shift has been pressed, false otherwise.
     */  
    const isMenuShortcutPressed = function isMenuShortcutPressed(keyboard) {

        // Ctrl+Alt+Shift has NOT been pressed if any key is currently held
        // down that isn't Ctrl, Alt, or Shift
        if (_.findKey(keyboard.pressed, (val, keysym) => !MENU_KEYS[keysym]))
            return false;

        // Verify that one of each required key is held, regardless of
        // left/right location on the keyboard
        return !!(
                _.findKey(SHIFT_KEYS, (val, keysym) => keyboard.pressed[keysym])
             && _.findKey(ALT_KEYS,   (val, keysym) => keyboard.pressed[keysym])
             && _.findKey(CTRL_KEYS,  (val, keysym) => keyboard.pressed[keysym])
        );

    };

    // Show menu if the user swipes from the left, hide menu when the user
    // swipes from the right, scroll menu while visible
    $scope.menuDrag = function menuDrag(inProgress, startX, startY, currentX, currentY, deltaX, deltaY) {

        if ($scope.menu.shown) {

            // Hide menu if swipe-from-right gesture is detected
            if (Math.abs(currentY - startY)  <  MENU_DRAG_VERTICAL_TOLERANCE
                      && startX   - currentX >= MENU_DRAG_DELTA)
                $scope.menu.shown = false;

            // Scroll menu by default
            else {
                $scope.menu.scrollState.left -= deltaX;
                $scope.menu.scrollState.top -= deltaY;
            }

        }

        // Show menu if swipe-from-left gesture is detected
        else if (startX <= MENU_DRAG_MARGIN) {
            if (Math.abs(currentY - startY) <  MENU_DRAG_VERTICAL_TOLERANCE
                      && currentX - startX  >= MENU_DRAG_DELTA)
                $scope.menu.shown = true;
        }

        return false;

    };

    // Show/hide UI elements depending on input method
    $scope.$watch('menu.inputMethod', function setInputMethod(inputMethod) {

        // Show input methods only if selected
        $scope.showOSK       = (inputMethod === 'osk');
        $scope.showTextInput = (inputMethod === 'text');

    });

    // Update client state/behavior as visibility of the Guacamole menu changes
    $scope.$watch('menu.shown', function menuVisibilityChanged(menuShown, menuShownPreviousState) {

        // Re-update available connection parameters, if there is a focused
        // client (parameter information may not have been available at the
        // time focus changed)
        if (menuShown)
            $scope.menu.connectionParameters = $scope.focusedClient ?
                ManagedClient.getArgumentModel($scope.focusedClient) : {};

        // Send any argument value data once menu is hidden
        else if (menuShownPreviousState)
            $scope.applyParameterChanges($scope.focusedClient);

        /* Broadcast changes to the menu display state */
        $scope.$broadcast('guacMenuShown', menuShown);

    });

    // Toggle the menu when the guacClientToggleMenu event is received
    $scope.$on('guacToggleMenu',
            () => $scope.menu.shown = !$scope.menu.shown);

    // Show the menu when the guacClientShowMenu event is received
    $scope.$on('guacShowMenu', () => $scope.menu.shown = true);

    // Hide the menu when the guacClientHideMenu event is received
    $scope.$on('guacHideMenu', () => $scope.menu.shown = false);

    // Automatically track and cache the currently-focused client
    $scope.$on('guacClientFocused', function focusedClientChanged(event, newFocusedClient) {

        const oldFocusedClient = $scope.focusedClient;
        $scope.focusedClient = newFocusedClient;

        // Apply any parameter changes when focus is changing
        if (oldFocusedClient)
            $scope.applyParameterChanges(oldFocusedClient);

        // Update available connection parameters, if there is a focused
        // client
        $scope.menu.connectionParameters = newFocusedClient ?
            ManagedClient.getArgumentModel(newFocusedClient) : {};

    });

    // Automatically update connection parameters that have been modified
    // for the current focused client
    $scope.$on('guacClientArgumentsUpdated', function argumentsChanged(event, focusedClient) {

        // Ignore any updated arguments not for the current focused client
        if ($scope.focusedClient && $scope.focusedClient === focusedClient)
            $scope.menu.connectionParameters = ManagedClient.getArgumentModel(focusedClient);

    });

    // Update page icon when thumbnail changes
    $scope.$watch('focusedClient.thumbnail.canvas', function thumbnailChanged(canvas) {
        iconService.setIcons(canvas);
    });

    // Pull sharing profiles once the tunnel UUID is known
    $scope.$watch('focusedClient.tunnel.uuid', function retrieveSharingProfiles(uuid) {

        // Only pull sharing profiles if tunnel UUID is actually available
        if (!uuid) {
            $scope.sharingProfiles = {};
            return;
        }

        // Pull sharing profiles for the current connection
        tunnelService.getSharingProfiles(uuid)
        .then(function sharingProfilesRetrieved(sharingProfiles) {
            $scope.sharingProfiles = sharingProfiles;
        }, requestService.WARN);

    });

    /**
     * Produces a sharing link for the current connection using the given
     * sharing profile. The resulting sharing link, and any required login
     * information, will be displayed to the user within the Guacamole menu.
     *
     * @param {SharingProfile} sharingProfile
     *     The sharing profile to use to generate the sharing link.
     */
    $scope.share = function share(sharingProfile) {
        if ($scope.focusedClient)
            ManagedClient.createShareLink($scope.focusedClient, sharingProfile);
    };

    /**
     * Returns whether the current connection has any associated share links.
     *
     * @returns {Boolean}
     *     true if the current connection has at least one associated share
     *     link, false otherwise.
     */
    $scope.isShared = function isShared() {
        return !!$scope.focusedClient && ManagedClient.isShared($scope.focusedClient);
    };

    /**
     * Returns the total number of share links associated with the current
     * connection.
     *
     * @returns {Number}
     *     The total number of share links associated with the current
     *     connection.
     */
    $scope.getShareLinkCount = function getShareLinkCount() {

        if (!$scope.focusedClient)
            return 0;

        // Count total number of links within the ManagedClient's share link map
        var linkCount = 0;
        for (const dummy in $scope.focusedClient.shareLinks)
            linkCount++;

        return linkCount;

    };

    // Opening the Guacamole menu after Ctrl+Alt+Shift, preventing those
    // keypresses from reaching any Guacamole client
    $scope.$on('guacBeforeKeydown', function incomingKeydown(event, keysym, keyboard) {

        // Toggle menu if menu shortcut (Ctrl+Alt+Shift) is pressed
        if (isMenuShortcutPressed(keyboard)) {
        
            // Don't send this key event through to the client, and release
            // all other keys involved in performing this shortcut
            event.preventDefault();
            keyboard.reset();
            
            // Toggle the menu
            $scope.$apply(function() {
                $scope.menu.shown = !$scope.menu.shown;
            });

        }

        // Prevent all keydown events while menu is open
        else if ($scope.menu.shown)
            event.preventDefault();

    });

    // Prevent all keyup events while menu is open
    $scope.$on('guacBeforeKeyup', function incomingKeyup(event, keysym, keyboard) {
        if ($scope.menu.shown)
            event.preventDefault();
    });

    // Send Ctrl-Alt-Delete when Ctrl-Alt-End is pressed.
    $scope.$on('guacKeydown', function keydownListener(event, keysym, keyboard) {

        // If one of the End keys is pressed, and we have a one keysym from each
        // of Ctrl and Alt groups, send Ctrl-Alt-Delete.
        if (END_KEYS[keysym]
            && _.findKey(ALT_KEYS,  (val, keysym) => keyboard.pressed[keysym])
            && _.findKey(CTRL_KEYS, (val, keysym) => keyboard.pressed[keysym])
        ) {

            // Don't send this event through to the client.
            event.preventDefault();

            // Record the substituted key press so that it can be
            // properly dealt with later.
            substituteKeysPressed[keysym] = DEL_KEY;

            // Send through the delete key.
            $scope.$broadcast('guacSyntheticKeydown', DEL_KEY);
        }

    });

    // Update pressed keys as they are released
    $scope.$on('guacKeyup', function keyupListener(event, keysym, keyboard) {

        // Deal with substitute key presses
        if (substituteKeysPressed[keysym]) {
            event.preventDefault();
            $scope.$broadcast('guacSyntheticKeyup', substituteKeysPressed[keysym]);
            delete substituteKeysPressed[keysym];
        }

    });

    // Update page title when client title changes
    $scope.$watch('getTitle(clientGroup)', function clientTitleChanged(title) {
        $scope.page.title = title;
    });

    /**
     * Returns whether the current connection has been flagged as unstable due
     * to an apparent network disruption.
     *
     * @returns {Boolean}
     *     true if the current connection has been flagged as unstable, false
     *     otherwise.
     */
    $scope.isConnectionUnstable = function isConnectionUnstable() {
        return _.findIndex($scope.clientGroup.clients, client => client.clientState.tunnelUnstable) !== -1;
    };

    /**
     * Immediately disconnects all currently-focused clients, if any.
     */
    $scope.disconnect = function disconnect() {

        // Disconnect if client is available
        if ($scope.clientGroup) {
            $scope.clientGroup.clients.forEach(client => {
                if (client.clientProperties.focused)
                    client.client.disconnect();
            });
        }

        // Hide menu
        $scope.menu.shown = false;

    };

    /**
     * Disconnects the given ManagedClient, removing it from the current
     * view.
     *
     * @param {ManagedClient} client
     *     The client to disconnect.
     */
    $scope.closeClientTile = function closeClientTile(client) {

        $scope.addRemoveClient(client.id, true);
        guacClientManager.removeManagedClient(client.id);

        // Ensure at least one client has focus (the only client with
        // focus may just have been removed)
        ManagedClientGroup.verifyFocus($scope.clientGroup);

    };

    /**
     * Action which immediately disconnects the currently-connected client, if
     * any.
     */
    var DISCONNECT_MENU_ACTION = {
        name      : 'CLIENT.ACTION_DISCONNECT',
        className : 'danger disconnect',
        callback  : $scope.disconnect
    };

    /**
     * Action that toggles fullscreen mode within the
     * currently-connected client and then closes the menu.
     */
    var FULLSCREEN_MENU_ACTION = {
        name      : 'CLIENT.ACTION_FULLSCREEN',
        classname : 'fullscreen action',
        callback  : function fullscreen() {
            
            guacFullscreen.toggleFullscreenMode();
            $scope.menu.shown = false;
        }
    };

    // Set client-specific menu actions
    $scope.clientMenuActions = [ DISCONNECT_MENU_ACTION,FULLSCREEN_MENU_ACTION ];

    /**
     * @borrows Protocol.getNamespace
     */
    $scope.getProtocolNamespace = Protocol.getNamespace;

    /**
     * The currently-visible filesystem within the filesystem menu, if the
     * filesystem menu is open. If no filesystem is currently visible, this
     * will be null.
     *
     * @type ManagedFilesystem
     */
    $scope.filesystemMenuContents = null;

    /**
     * Hides the filesystem menu.
     */
    $scope.hideFilesystemMenu = function hideFilesystemMenu() {
        $scope.filesystemMenuContents = null;
    };

    /**
     * Shows the filesystem menu, displaying the contents of the given
     * filesystem within it.
     *
     * @param {ManagedFilesystem} filesystem
     *     The filesystem to show within the filesystem menu.
     */
    $scope.showFilesystemMenu = function showFilesystemMenu(filesystem) {
        $scope.filesystemMenuContents = filesystem;
    };

    /**
     * Returns whether the filesystem menu should be visible.
     *
     * @returns {Boolean}
     *     true if the filesystem menu is shown, false otherwise.
     */
    $scope.isFilesystemMenuShown = function isFilesystemMenuShown() {
        return !!$scope.filesystemMenuContents && $scope.menu.shown;
    };

    // Automatically refresh display when filesystem menu is shown
    $scope.$watch('isFilesystemMenuShown()', function refreshFilesystem() {

        // Refresh filesystem, if defined
        var filesystem = $scope.filesystemMenuContents;
        if (filesystem)
            ManagedFilesystem.refresh(filesystem, filesystem.currentDirectory);

    });

    /**
     * Returns the full path to the given file as an ordered array of parent
     * directories.
     *
     * @param {ManagedFilesystem.File} file
     *     The file whose full path should be retrieved.
     *
     * @returns {ManagedFilesystem.File[]}
     *     An array of directories which make up the hierarchy containing the
     *     given file, in order of increasing depth.
     */
    $scope.getPath = function getPath(file) {

        var path = [];

        // Add all files to path in ascending order of depth
        while (file && file.parent) {
            path.unshift(file);
            file = file.parent;
        }

        return path;

    };

    /**
     * Changes the current directory of the given filesystem to the given
     * directory.
     *
     * @param {ManagedFilesystem} filesystem
     *     The filesystem whose current directory should be changed.
     *
     * @param {ManagedFilesystem.File} file
     *     The directory to change to.
     */
    $scope.changeDirectory = function changeDirectory(filesystem, file) {
        ManagedFilesystem.changeDirectory(filesystem, file);
    };

    /**
     * Begins a file upload through the attached Guacamole client for
     * each file in the given FileList.
     *
     * @param {FileList} files
     *     The files to upload.
     */
    $scope.uploadFiles = function uploadFiles(files) {

        // Upload each file
        for (var i = 0; i < files.length; i++)
            ManagedClient.uploadFile($scope.filesystemMenuContents.client, files[i], $scope.filesystemMenuContents);

    };
    
    /**
     * Determines whether the attached client group has any associated file
     * transfers, regardless of those file transfers' state.
     *
     * @returns {Boolean}
     *     true if there are any file transfers associated with the
     *     attached client group, false otherise.
     */
    $scope.hasTransfers = function hasTransfers() {

        // There are no file transfers if there is no client group
        if (!$scope.clientGroup)
            return false;

        return _.findIndex($scope.clientGroup.clients, ManagedClient.hasTransfers) !== -1;

    };

    /**
     * Returns whether the current user can share the current connection with
     * other users. A connection can be shared if and only if there is at least
     * one associated sharing profile.
     *
     * @returns {Boolean}
     *     true if the current user can share the current connection with other
     *     users, false otherwise.
     */
    $scope.canShareConnection = function canShareConnection() {

        // If there is at least one sharing profile, the connection can be shared
        for (var dummy in $scope.sharingProfiles)
            return true;

        // Otherwise, sharing is not possible
        return false;

    };

    // Clean up when view destroyed
    $scope.$on('$destroy', function clientViewDestroyed() {
        setAttachedGroup(null);

        // always unset fullscreen mode to not confuse user 
        guacFullscreen.setFullscreenMode(false);
    });

}]);
