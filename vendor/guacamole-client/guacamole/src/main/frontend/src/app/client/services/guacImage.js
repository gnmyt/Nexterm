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
 * A service for checking browser image support.
 */
angular.module('client').factory('guacImage', ['$injector', function guacImage($injector) {

    // Required services
    var $q = $injector.get('$q');

    var service = {};

    /**
     * Map of possibly-supported image mimetypes to corresponding test images
     * encoded with base64. If the image is correctly decoded, it will be a
     * single pixel (1x1) image.
     *
     * @type Object.<String, String>
     */
    var testImages = {

        /**
         * Test JPEG image, encoded as base64.
         */
        'image/jpeg' :
            '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH'
          + 'BwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME'
          + 'BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU'
          + 'FBQUFBQUFBQUFBQUFBT/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAA'
          + 'AAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAA'
          + 'AAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AVMH/2Q==',

        /**
         * Test PNG image, encoded as base64.
         */
        'image/png' :
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvI'
          + 'AAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==',

        /**
         * Test WebP image, encoded as base64.
         */
        'image/webp' : 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='

    };

    /**
     * Deferred which tracks the progress and ultimate result of all pending
     * image format tests.
     *
     * @type Deferred
     */
    var deferredSupportedMimetypes = $q.defer();

    /**
     * Array of all promises associated with pending image tests. Each image
     * test promise MUST be guaranteed to resolve and MUST NOT be rejected.
     *
     * @type Promise[]
     */
    var pendingTests = [];

    /**
     * The array of supported image formats. This will be gradually populated
     * by the various image tests that occur in the background, and will not be
     * fully populated until all promises within pendingTests are resolved.
     *
     * @type String[]
     */
    var supported = [];

    /**
     * Return a promise which resolves with to an array of image mimetypes
     * supported by the browser, once those mimetypes are known. The returned
     * promise is guaranteed to resolve successfully.
     *
     * @returns {Promise.<String[]>}
     *     A promise which resolves with an array of image mimetypes supported
     *     by the browser.
     */
    service.getSupportedMimetypes = function getSupportedMimetypes() {
        return deferredSupportedMimetypes.promise;
    };

    // Test each possibly-supported image
    angular.forEach(testImages, function testImageSupport(data, mimetype) {

        // Add promise for current image test
        var imageTest = $q.defer();
        pendingTests.push(imageTest.promise);

        // Attempt to load image
        var image = new Image();
        image.src = 'data:' + mimetype + ';base64,' + data;

        // Store as supported depending on whether load was successful
        image.onload = image.onerror = function imageTestComplete() {

            // Image format is supported if successfully decoded
            if (image.width === 1 && image.height === 1)
                supported.push(mimetype);

            // Test is complete
            imageTest.resolve();

        };

    });

    // When all image tests are complete, resolve promise with list of
    // supported formats
    $q.all(pendingTests).then(function imageTestsCompleted() {
        deferredSupportedMimetypes.resolve(supported);
    });

    return service;

}]);
