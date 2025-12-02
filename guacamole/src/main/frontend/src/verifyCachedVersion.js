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
 * Automatically reloads the current page and clears relevant browser cache if
 * the build that produced index.html is different/older than the build that
 * produced the JavaScript loaded by index.html.
 *
 * @private
 * @param {Location} location
 *     The Location object representing the URL of the current page.
 *
 * @param {Storate} [sessionStorage]
 *     The Storage object that should optionally be used to avoid reloading the
 *     current page in a loop if it proves impossible to clear cache.
 */
(function verifyCachedVersion(location, sessionStorage) {

    /**
     * The meta element containing the build identifier of the Guacamole build
     * that produced index.html.
     *
     * @private
     * @type {HTMLMetaElement}
     */
    var buildMeta = document.head.querySelector('meta[name=build]');

    // Verify that index.html came from the same build as this JavaScript file,
    // forcing a reload if out-of-date
    if (!buildMeta || buildMeta.content !== '${guacamole.build.identifier}') {

        if (sessionStorage) {

            // Bail out if we have already tried to automatically refresh the
            // cache but were unsuccessful
            if (sessionStorage.getItem('reloadedFor') === '${guacamole.build.identifier}') {
                console.warn('The version of Guacamole cached by your '
                    + 'browser does not match the version of Guacamole on the '
                    + 'server. To avoid unexpected errors, please clear your '
                    + 'browser cache.');
                return;
            }

            sessionStorage.setItem('reloadedFor', '${guacamole.build.identifier}');

        }

        // Force refresh of cache by issuing an HTTP request with headers that
        // request revalidation of cached content
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '', true);
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.setRequestHeader('Pragma', 'no-cache');

        xhr.onreadystatechange = function readyStateChanged() {

            // Reload current page when ready (this call to reload MAY be
            // sufficient in itself to clear cache, but this is not
            // guaranteed by any standard)
            if (xhr.readyState === XMLHttpRequest.DONE)
                location.reload(true);

        };

        xhr.send();

    }

})(window.location, window.sessionStorage);
