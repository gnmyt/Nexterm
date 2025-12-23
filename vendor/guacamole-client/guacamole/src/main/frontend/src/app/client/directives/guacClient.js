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
 * A directive for the guacamole client.
 */
angular.module('client').directive('guacClient', [function guacClient() {

    const directive = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/client/templates/guacClient.html'
    };

    directive.scope = {

        /**
         * The client to display within this guacClient directive.
         * 
         * @type ManagedClient
         */
        client : '=',

        /**
         * Whether translation of touch to mouse events should emulate an
         * absolute pointer device, or a relative pointer device.
         *
         * @type boolean
         */
        emulateAbsoluteMouse : '='

    };

    directive.controller = ['$scope', '$injector', '$element',
        function guacClientController($scope, $injector, $element) {

        // Required types
        const ManagedClient = $injector.get('ManagedClient');
            
        // Required services
        const $rootScope = $injector.get('$rootScope');
        const $window = $injector.get('$window');
            
        /**
         * Whether the local, hardware mouse cursor is in use.
         * 
         * @type Boolean
         */
        let localCursor = false;

        /**
         * The current Guacamole client instance.
         * 
         * @type Guacamole.Client 
         */
        let client = null;

        /**
         * The display of the current Guacamole client instance.
         * 
         * @type Guacamole.Display
         */
        let display = null;

        /**
         * The element associated with the display of the current
         * Guacamole client instance.
         *
         * @type Element
         */
        let displayElement = null;

        /**
         * The element which must contain the Guacamole display element.
         *
         * @type Element
         */
        const displayContainer = $element.find('.display')[0];

        /**
         * The main containing element for the entire directive.
         * 
         * @type Element
         */
        const main = $element[0];

        /**
         * Guacamole mouse event object, wrapped around the main client
         * display.
         *
         * @type Guacamole.Mouse
         */
        const mouse = new Guacamole.Mouse(displayContainer);

        /**
         * Guacamole absolute mouse emulation object, wrapped around the
         * main client display.
         *
         * @type Guacamole.Mouse.Touchscreen
         */
        const touchScreen = new Guacamole.Mouse.Touchscreen(displayContainer);

        /**
         * Guacamole relative mouse emulation object, wrapped around the
         * main client display.
         *
         * @type Guacamole.Mouse.Touchpad
         */
        const touchPad = new Guacamole.Mouse.Touchpad(displayContainer);

        /**
         * Guacamole touch event handling object, wrapped around the main
         * client dislay.
         *
         * @type Guacamole.Touch
         */
        const touch = new Guacamole.Touch(displayContainer);

        /**
         * Updates the scale of the attached Guacamole.Client based on current window
         * size and "auto-fit" setting.
         */
        const updateDisplayScale = function updateDisplayScale() {

            if (!display) return;

            // Calculate scale to fit screen
            $scope.client.clientProperties.minScale = Math.min(
                main.offsetWidth  / Math.max(display.getWidth(),  1),
                main.offsetHeight / Math.max(display.getHeight(), 1)
            );

            // Calculate appropriate maximum zoom level
            $scope.client.clientProperties.maxScale = Math.max($scope.client.clientProperties.minScale, 3);

            // Clamp zoom level, maintain auto-fit
            if (display.getScale() < $scope.client.clientProperties.minScale || $scope.client.clientProperties.autoFit)
                $scope.client.clientProperties.scale = $scope.client.clientProperties.minScale;

            else if (display.getScale() > $scope.client.clientProperties.maxScale)
                $scope.client.clientProperties.scale = $scope.client.clientProperties.maxScale;

        };

        /**
         * Scrolls the client view such that the mouse cursor is visible.
         *
         * @param {Guacamole.Mouse.State} mouseState The current mouse
         *                                           state.
         */
        const scrollToMouse = function scrollToMouse(mouseState) {

            // Determine mouse position within view
            const mouse_view_x = mouseState.x + displayContainer.offsetLeft - main.scrollLeft;
            const mouse_view_y = mouseState.y + displayContainer.offsetTop  - main.scrollTop;

            // Determine viewport dimensions
            const view_width  = main.offsetWidth;
            const view_height = main.offsetHeight;

            // Determine scroll amounts based on mouse position relative to document

            let scroll_amount_x;
            if (mouse_view_x > view_width)
                scroll_amount_x = mouse_view_x - view_width;
            else if (mouse_view_x < 0)
                scroll_amount_x = mouse_view_x;
            else
                scroll_amount_x = 0;

            let scroll_amount_y;
            if (mouse_view_y > view_height)
                scroll_amount_y = mouse_view_y - view_height;
            else if (mouse_view_y < 0)
                scroll_amount_y = mouse_view_y;
            else
                scroll_amount_y = 0;

            // Scroll (if necessary) to keep mouse on screen.
            main.scrollLeft += scroll_amount_x;
            main.scrollTop  += scroll_amount_y;

        };

        /**
         * Return the name of the angular event associated with the provided
         * mouse event.
         *
         * @param {Guacamole.Mouse.MouseEvent} event
         *     The mouse event to determine an angular event name for.
         *
         * @returns
         *     The name of the angular event associated with the provided
         *     mouse event.
         */
        const getMouseEventName = event => {
            switch (event.type) {
                case 'mousedown':
                    return 'guacClientMouseDown';
                case 'mouseup':
                    return 'guacClientMouseUp';
                default:
                    return 'guacClientMouseMove';
            }
        };

        /**
         * Handles a mouse event originating from the user's actual mouse.
         * This differs from handleEmulatedMouseEvent() in that the
         * software mouse cursor must be shown only if the user's browser
         * does not support explicitly setting the hardware mouse cursor.
         *
         * @param {Guacamole.Mouse.MouseEvent} event
         *     The mouse event to handle.
         */
        const handleMouseEvent = function handleMouseEvent(event) {

            // Do not attempt to handle mouse state changes if the client
            // or display are not yet available
            if (!client || !display)
                return;

            event.stopPropagation();
            event.preventDefault();

            // Send mouse state, show cursor if necessary
            display.showCursor(!localCursor);
            client.sendMouseState(event.state, true);

            // Broadcast the mouse event
            $rootScope.$broadcast(getMouseEventName(event), event, client);

        };

        /**
         * Handles a mouse event originating from one of Guacamole's mouse
         * emulation objects. This differs from handleMouseState() in that
         * the software mouse cursor must always be shown (as the emulated
         * mouse device will not have its own cursor).
         *
         * @param {Guacamole.Mouse.MouseEvent} event
         *     The mouse event to handle.
         */
        const handleEmulatedMouseEvent = function handleEmulatedMouseEvent(event) {

            // Do not attempt to handle mouse state changes if the client
            // or display are not yet available
            if (!client || !display)
                return;

            event.stopPropagation();
            event.preventDefault();

            // Ensure software cursor is shown
            display.showCursor(true);

            // Send mouse state, ensure cursor is visible
            scrollToMouse(event.state);
            client.sendMouseState(event.state, true);

            // Broadcast the mouse event
            $rootScope.$broadcast(getMouseEventName(event), event, client);

        };

        /**
         * Return the name of the angular event associated with the provided
         * touch event.
         *
         * @param {Guacamole.Touch.TouchEvent} event
         *     The touch event to determine an angular event name for.
         *
         * @returns
         *     The name of the angular event associated with the provided
         *     touch event.
         */
        const getTouchEventName = event => {
            switch (event.type) {
                case 'touchstart':
                    return 'guacClientTouchStart';
                case 'touchend':
                    return 'guacClientTouchEnd';
                default:
                    return 'guacClientTouchMove';
            }
        };

        /**
         * Handles a touch event originating from the user's device.
         *
         * @param {Guacamole.Touch.Event} touchEvent
         *     The touch event.
         */
        const handleTouchEvent = function handleTouchEvent(event) {

            // Do not attempt to handle touch state changes if the client
            // or display are not yet available
            if (!client || !display)
                return;

            event.preventDefault();

            // Send touch state, hiding local cursor
            display.showCursor(false);
            client.sendTouchState(event.state, true);

            // Broadcast the touch event
            $rootScope.$broadcast(getTouchEventName(event), event, client);

        };

        // Attach any given managed client
        $scope.$watch('client', function attachManagedClient(managedClient) {

            // Remove any existing display
            displayContainer.innerHTML = "";

            // Only proceed if a client is given 
            if (!managedClient)
                return;

            // Get Guacamole client instance
            client = managedClient.client;

            // Attach possibly new display
            display = client.getDisplay();
            display.scale($scope.client.clientProperties.scale);

            // Add display element
            displayElement = display.getElement();
            displayContainer.appendChild(displayElement);

            // Do nothing when the display element is clicked on
            display.getElement().onclick = function(e) {
                e.preventDefault();
                return false;
            };

            // Connect and update interface to match required size, deferring
            // connecting until a future element resize if the main element
            // size (desired display size) is not known and thus can't be sent
            // during the handshake
            $scope.mainElementResized();

        });

        // Update actual view scrollLeft when scroll properties change
        $scope.$watch('client.clientProperties.scrollLeft', function scrollLeftChanged(scrollLeft) {
            main.scrollLeft = scrollLeft;
            $scope.client.clientProperties.scrollLeft = main.scrollLeft;
        });

        // Update actual view scrollTop when scroll properties change
        $scope.$watch('client.clientProperties.scrollTop', function scrollTopChanged(scrollTop) {
            main.scrollTop = scrollTop;
            $scope.client.clientProperties.scrollTop = main.scrollTop;
        });

        // Update scale when display is resized
        $scope.$watch('client.managedDisplay.size', function setDisplaySize() {
            $scope.$evalAsync(updateDisplayScale);
        });

        // Keep local cursor up-to-date
        $scope.$watch('client.managedDisplay.cursor', function setCursor(cursor) {
            if (cursor)
                localCursor = mouse.setCursor(cursor.canvas, cursor.x, cursor.y);
        });

        // Update touch event handling depending on remote multi-touch
        // support and mouse emulation mode
        $scope.$watchGroup([
                'client.multiTouchSupport',
                'emulateAbsoluteMouse'
            ], function touchBehaviorChanged() {

            // Clear existing event handling
            touch.offEach(['touchstart', 'touchmove', 'touchend'], handleTouchEvent);
            touchScreen.offEach(['mousedown', 'mousemove', 'mouseup'], handleEmulatedMouseEvent);
            touchPad.offEach(['mousedown', 'mousemove', 'mouseup'], handleEmulatedMouseEvent);

            // Directly forward local touch events
            if ($scope.client.multiTouchSupport)
                touch.onEach(['touchstart', 'touchmove', 'touchend'], handleTouchEvent);

            // Switch to touchscreen if mouse emulation is required and
            // absolute mouse emulation is preferred
            else if ($scope.emulateAbsoluteMouse)
                touchScreen.onEach(['mousedown', 'mousemove', 'mouseup'], handleEmulatedMouseEvent);

            // Use touchpad for mouse emulation if absolute mouse emulation
            // is not preferred
            else
                touchPad.onEach(['mousedown', 'mousemove', 'mouseup'], handleEmulatedMouseEvent);

        });

        // Adjust scale if modified externally
        $scope.$watch('client.clientProperties.scale', function changeScale(scale) {

            // Fix scale within limits
            scale = Math.max(scale, $scope.client.clientProperties.minScale);
            scale = Math.min(scale, $scope.client.clientProperties.maxScale);

            // If at minimum zoom level, hide scroll bars
            if (scale === $scope.client.clientProperties.minScale)
                main.style.overflow = "hidden";

            // If not at minimum zoom level, show scroll bars
            else
                main.style.overflow = "auto";

            // Apply scale if client attached
            if (display)
                display.scale(scale);
            
            if (scale !== $scope.client.clientProperties.scale)
                $scope.client.clientProperties.scale = scale;

        });
        
        // If autofit is set, the scale should be set to the minimum scale, filling the screen
        $scope.$watch('client.clientProperties.autoFit', function changeAutoFit(autoFit) {
            if(autoFit)
                $scope.client.clientProperties.scale = $scope.client.clientProperties.minScale;
        });

        /**
         * Sends the current size of the main element (the display container)
         * to the Guacamole server, requesting that the remote display be
         * resized. If the Guacamole client is not yet connected, it will be
         * connected and the current size will sent through the initial
         * handshake. If the size of the main element is not yet known, this
         * function may need to be invoked multiple times until the size is
         * known and the client may be connected.
         */
        $scope.mainElementResized = function mainElementResized() {

            // Send new display size, if changed
            if (client && display && main.offsetWidth && main.offsetHeight) {

                // Connect, if not already connected
                ManagedClient.connect($scope.client, main.offsetWidth, main.offsetHeight);

                const pixelDensity = $window.devicePixelRatio || 1;
                const width  = main.offsetWidth  * pixelDensity;
                const height = main.offsetHeight * pixelDensity;

                if (display.getWidth() !== width || display.getHeight() !== height)
                    client.sendSize(width, height);

            }

            $scope.$evalAsync(updateDisplayScale);

        };

        // Scroll client display if absolute mouse is in use (the same drag
        // gesture is needed for moving the mouse pointer with relative mouse)
        $scope.clientDrag = function clientDrag(inProgress, startX, startY, currentX, currentY, deltaX, deltaY) {

            if ($scope.emulateAbsoluteMouse) {
                $scope.client.clientProperties.scrollLeft -= deltaX;
                $scope.client.clientProperties.scrollTop -= deltaY;
            }

            return false;

        };

        /**
         * If a pinch gesture is in progress, the scale of the client display when
         * the pinch gesture began.
         *
         * @type Number
         */
        let initialScale = null;

        /**
         * If a pinch gesture is in progress, the X coordinate of the point on the
         * client display that was centered within the pinch at the time the
         * gesture began.
         * 
         * @type Number
         */
        let initialCenterX = 0;

        /**
         * If a pinch gesture is in progress, the Y coordinate of the point on the
         * client display that was centered within the pinch at the time the
         * gesture began.
         * 
         * @type Number
         */
        let initialCenterY = 0;

        // Zoom and pan client via pinch gestures
        $scope.clientPinch = function clientPinch(inProgress, startLength, currentLength, centerX, centerY) {

            // Do not handle pinch gestures if they would conflict with remote
            // handling of similar gestures
            if ($scope.client.multiTouchSupport > 1)
                return false;

            // Do not handle pinch gestures while relative mouse is in use (2+
            // contact point gestures are used by relative mouse emulation to
            // support right click, middle click, and scrolling)
            if (!$scope.emulateAbsoluteMouse)
                return false;

            // Stop gesture if not in progress
            if (!inProgress) {
                initialScale = null;
                return false;
            }

            // Set initial scale if gesture has just started
            if (!initialScale) {
                initialScale   = $scope.client.clientProperties.scale;
                initialCenterX = (centerX + $scope.client.clientProperties.scrollLeft) / initialScale;
                initialCenterY = (centerY + $scope.client.clientProperties.scrollTop)  / initialScale;
            }

            // Determine new scale absolutely
            let currentScale = initialScale * currentLength / startLength;

            // Fix scale within limits - scroll will be miscalculated otherwise
            currentScale = Math.max(currentScale, $scope.client.clientProperties.minScale);
            currentScale = Math.min(currentScale, $scope.client.clientProperties.maxScale);

            // Update scale based on pinch distance
            $scope.client.clientProperties.autoFit = false;
            $scope.client.clientProperties.scale = currentScale;

            // Scroll display to keep original pinch location centered within current pinch
            $scope.client.clientProperties.scrollLeft = initialCenterX * currentScale - centerX;
            $scope.client.clientProperties.scrollTop  = initialCenterY * currentScale - centerY;

            return false;

        };

        // Ensure focus is regained via mousedown before forwarding event
        mouse.on('mousedown', document.body.focus.bind(document.body));

        // Forward all mouse events
        mouse.onEach(['mousedown', 'mousemove', 'mouseup'], handleMouseEvent);

        // Hide software cursor when mouse leaves display
        mouse.on('mouseout', function() {
            if (!display) return;
            display.showCursor(false);
        });

        // Update remote clipboard if local clipboard changes
        $scope.$on('guacClipboard', function onClipboard(event, data) {
            ManagedClient.setClipboard($scope.client, data);
        });

        // Translate local keydown events to remote keydown events if keyboard is enabled
        $scope.$on('guacKeydown', function keydownListener(event, keysym, keyboard) {
            if ($scope.client.clientProperties.focused) {
                client.sendKeyEvent(1, keysym);
                event.preventDefault();
            }
        });
        
        // Translate local keyup events to remote keyup events if keyboard is enabled
        $scope.$on('guacKeyup', function keyupListener(event, keysym, keyboard) {
            if ($scope.client.clientProperties.focused) {
                client.sendKeyEvent(0, keysym);
                event.preventDefault();
            }   
        });

        // Universally handle all synthetic keydown events
        $scope.$on('guacSyntheticKeydown', function syntheticKeydownListener(event, keysym) {
            if ($scope.client.clientProperties.focused)
                client.sendKeyEvent(1, keysym);
        });
        
        // Universally handle all synthetic keyup events
        $scope.$on('guacSyntheticKeyup', function syntheticKeyupListener(event, keysym) {
            if ($scope.client.clientProperties.focused)
                client.sendKeyEvent(0, keysym);
        });

        /**
         * Whether a drag/drop operation is currently in progress (the user has
         * dragged a file over the Guacamole connection but has not yet
         * dropped it).
         *
         * @type boolean
         */
        $scope.dropPending = false;
            
        /**
         * Displays a visual indication that dropping the file currently
         * being dragged is possible. Further propagation and default behavior
         * of the given event is automatically prevented.
         * 
         * @param {Event} e
         *     The event related to the in-progress drag/drop operation.
         */
        const notifyDragStart = function notifyDragStart(e) {

            e.preventDefault();
            e.stopPropagation();

            $scope.$apply(() => {
                $scope.dropPending = true;
            });

        };

        /**
         * Removes the visual indication that dropping the file currently
         * being dragged is possible. Further propagation and default behavior
         * of the given event is automatically prevented.
         * 
         * @param {Event} e
         *     The event related to the end of the former drag/drop operation.
         */
        const notifyDragEnd = function notifyDragEnd(e) {

            e.preventDefault();
            e.stopPropagation();

            $scope.$apply(() => {
                $scope.dropPending = false;
            });

        };

        main.addEventListener('dragenter', notifyDragStart, false);
        main.addEventListener('dragover',  notifyDragStart, false);
        main.addEventListener('dragleave', notifyDragEnd,   false);

        // File drop event handler
        main.addEventListener('drop', function(e) {

            notifyDragEnd(e);

            // Ignore file drops if no attached client
            if (!$scope.client)
                return;

            // Upload each file 
            const files = e.dataTransfer.files;
            for (let i = 0; i < files.length; i++)
                ManagedClient.uploadFile($scope.client, files[i]);

        }, false);

    }];

    return directive;

}]);
