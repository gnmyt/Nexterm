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
 * Reformats the URL of the current page such that normal query parameters will
 * be received by AngularJS. If possible, this reformatting operation will be
 * performed using the HTML5 History API, thus avoiding reloading the page.
 *
 * For example, if a user visits the following URL:
 *
 *     http://example.org/some/application/?foo=bar
 *
 * this script will reformat the URL as:
 *
 *     http://example.org/some/application/#/?foo=bar
 *
 * If the URL does not contain query parameters, or the query parameters are
 * already in a format which AngularJS can read, then the URL is left
 * untouched.
 *
 * If query parameters are present both in the normal non-Angular format AND
 * within the URL fragment identifier, the query parameters are merged such
 * that AngularJS can read all parameters.
 *
 * @private
 * @param {Location} location
 *     The Location object representing the URL of the current page.
 */
(function relocateParameters(location){

    /**
     * The default path, including leading '#' character, which should be used
     * if the URL of the current page has no fragment identifier.
     *
     * @constant
     * @type String
     */
    var DEFAULT_ANGULAR_PATH = '#/';

    /**
     * The query parameters within the URL of the current page, including the
     * leading '?' character.
     *
     * @type String
     */
    var parameters = location.search;

    /**
     * The base URL of the current page, containing only the protocol, hostname,
     * and path. Query parameters and the fragment, if any, are excluded.
     *
     * @type String
     */
    var baseUrl = location.origin + location.pathname;

    /**
     * The Angular-specific path within the fragment identifier of the URL of
     * the current page, including the leading '#' character of the fragment
     * identifier. If no fragment identifier is present, the deafult path will
     * be used.
     *
     * @type String
     */
    var angularUrl = location.hash || DEFAULT_ANGULAR_PATH;

    /**
     * Appends the given parameter string to the given URL. The URL may already
     * contain parameters.
     *
     * @param {String} url
     *     The URL that the given parameters should be appended to, which may
     *     already contain parameters.
     *
     * @param {String} parameters
     *     The parameters which should be appended to the given URL, including
     *     leading '?' character.
     *
     * @returns {String}
     *     A properly-formatted URL consisting of the given URL and additional
     *     parameters.
     */
    var appendParameters = function appendParameters(url, parameters) {

        // If URL already contains parameters, replace the leading '?' with an
        // '&' prior to appending more parameters
        if (url.indexOf('?') !== -1)
            return url + '&' + parameters.substring(1);

        // Otherwise, the provided parameters already contains the necessary
        // '?' character - just append
        return url + parameters;

    };

    // If non-Angular query parameters are present, reformat the URL such that
    // they are after the path and thus visible to Angular
    if (parameters) {

        // Reformat the URL such that query parameters are after Angular's path
        var reformattedUrl = appendParameters(baseUrl + angularUrl, parameters);

        // Simply rewrite the visible URL if the HTML5 History API is supported
        if (window.history && history.replaceState)
            history.replaceState(null, document.title, reformattedUrl);

        // Otherwise, redirect to the reformatted URL
        else
            location.href = reformattedUrl;

    }

})(window.location);
