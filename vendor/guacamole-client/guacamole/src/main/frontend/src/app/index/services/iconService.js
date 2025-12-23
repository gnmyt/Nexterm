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
 * A service for updating or resetting the favicon of the current page.
 */
angular.module('index').factory('iconService', ['$rootScope', function iconService($rootScope) {

    var service = {};

    /**
     * The URL of the image used for the low-resolution (64x64) favicon. This
     * MUST match the URL which is set statically within index.html.
     *
     * @constant
     * @type String
     */
    var DEFAULT_SMALL_ICON_URL = 'images/logo-64.png';

    /**
     * The URL of the image used for the high-resolution (144x144) favicon. This
     * MUST match the URL which is set statically within index.html.
     *
     * @constant
     * @type String
     */
    var DEFAULT_LARGE_ICON_URL = 'images/logo-144.png';

    /**
     * JQuery-wrapped array of all link tags which point to the small,
     * low-resolution page icon.
     *
     * @type Element[]
     */
    var smallIcons = $('link[rel=icon][href="' + DEFAULT_SMALL_ICON_URL + '"]');

    /**
     * JQuery-wrapped array of all link tags which point to the large,
     * high-resolution page icon.
     *
     * @type Element[]
     */
    var largeIcons = $('link[rel=icon][href="' + DEFAULT_LARGE_ICON_URL + '"]');

    /**
     * Generates an icon by scaling the provided image to fit the given
     * dimensions, returning a canvas containing the generated icon.
     *
     * @param {HTMLCanvasElement} canvas
     *     A canvas element containing the image which should be scaled to
     *     produce the contents of the generated icon.
     *
     * @param {Number} width
     *     The width of the icon to generate, in pixels.
     *
     * @param {Number} height
     *     The height of the icon to generate, in pixels.
     *
     * @returns {HTMLCanvasElement}
     *     A new canvas element having the given dimensions and containing the
     *     provided image, scaled to fit.
     */
    var generateIcon = function generateIcon(canvas, width, height) {

        // Create icon canvas having the provided dimensions
        var icon = document.createElement('canvas');
        icon.width = width;
        icon.height = height;

        // Calculate the scale factor necessary to fit the provided image
        // within the icon dimensions
        var scale = Math.min(width / canvas.width, height / canvas.height);

        // Calculate the dimensions and position of the scaled image within
        // the icon, offsetting the image such that it is centered
        var scaledWidth = canvas.width * scale;
        var scaledHeight = canvas.height * scale;
        var offsetX = (width - scaledWidth) / 2;
        var offsetY = (height - scaledHeight) / 2;

        // Draw the icon, scaling the provided image as necessary
        var context = icon.getContext('2d');
        context.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight);
        return icon;

    };

    /**
     * Temporarily sets the icon of the current page to the contents of the
     * given canvas element. The image within the canvas element will be
     * automatically scaled and centered to fit within the dimensions of the
     * page icons. The page icons will be automatically reset to their original
     * values upon navigation.
     *
     * @param {HTMLCanvasElement} canvas
     *     The canvas element containing the icon. If this value is null or
     *     undefined, this function has no effect.
     */
    service.setIcons = function setIcons(canvas) {

        // Do nothing if no canvas provided
        if (!canvas)
            return;

        // Assign low-resolution (64x64) icon
        var smallIcon = generateIcon(canvas, 64, 64);
        smallIcons.attr('href', smallIcon.toDataURL('image/png'));

        // Assign high-resolution (144x144) icon
        var largeIcon = generateIcon(canvas, 144, 144);
        largeIcons.attr('href', largeIcon.toDataURL('image/png'));

    };

    /**
     * Resets the icons of the current page to their original values, undoing
     * any previous calls to setIcons(). This function is automatically invoked
     * upon navigation.
     */
    service.setDefaultIcons = function setDefaultIcons() {
        smallIcons.attr('href', DEFAULT_SMALL_ICON_URL);
        largeIcons.attr('href', DEFAULT_LARGE_ICON_URL);
    };

    // Automatically reset page icons after navigation
    $rootScope.$on('$routeChangeSuccess', function resetIcon() {
        service.setDefaultIcons();
    });

    return service;

}]);
