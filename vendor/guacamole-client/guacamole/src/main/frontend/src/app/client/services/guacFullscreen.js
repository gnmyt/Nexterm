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
 * A service for providing true fullscreen and keyboard lock support.
 * Keyboard lock is currently only supported by Chromium based browsers
 * (Edge >= V79, Chrome >= V68 and Opera >= V55)
 */
angular.module('client').factory('guacFullscreen', ['$injector', 
        function guacFullscreen($injector) {

    var service = {};

    // check is browser in true fullscreen mode
    service.isInFullscreenMode = function isInFullscreenMode() {
        return document.fullscreenElement;
    }

    // set fullscreen mode
    service.setFullscreenMode = function setFullscreenMode(state) {
        if (document.fullscreenEnabled) {
            if (state && !service.isInFullscreenMode())
                document.documentElement.requestFullscreen();
            else if (!state && service.isInFullscreenMode())
                document.exitFullscreen();
        }
    }

    // toggles current fullscreen mode (off if on, on if off)
    service.toggleFullscreenMode = function toggleFullscreenMode() {
        if (!service.isInFullscreenMode())
            service.setFullscreenMode(true);
        else
            service.setFullscreenMode(false);
    }

    // If the browser supports keyboard lock, lock the keyboard when entering
    // fullscreen mode and unlock it when exiting fullscreen mode.
    if (navigator.keyboard?.lock) {
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                navigator.keyboard.lock();
                return;
            }

            navigator.keyboard.unlock();
        });
    }

    return service;
    
}]);
