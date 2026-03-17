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
 * Overrides $templateRequest such that HTML patches defined within Guacamole
 * extensions are automatically applied to template contents. As the results of
 * $templateRequest are cached internally, $templateCache is also overridden to
 * update the internal cache as necessary.
 */
angular.module('index').config(['$provide', function($provide) {

    /**
     * A map of previously-returned promises from past calls to
     * $templateRequest(). Future calls to $templateRequest() will return
     * new promises chained to the first promise returned for a given URL,
     * rather than redo patch processing for every request.
     *
     * @type Object.<String, Promise.<String>>
     */
    var promiseCache = {};

    // Decorate $templateCache such that promiseCache is updated if a template
    // is modified within $templateCache at runtime
    $provide.decorator('$templateCache', ['$delegate',
            function decorateTemplateCache($delegate) {

        // Create shallow copy of original $templateCache which we can safely
        // override
        var decoratedTemplateCache = angular.extend({}, $delegate);

        /**
         * Overridden version of $templateCache.put() which automatically
         * invalidates the cached $templateRequest result when used. Only the
         * URL parameter is defined, as all other arguments, if any, will be
         * passed through to the original $templateCache.put() when the actual
         * put() operation is performed.
         *
         * @param {String} url
         *     The URL of the template whose entry is being updated.
         *
         * @return {Object}
         *     The value returned by $templateCache.put(), which is defined as
         *     being the value that was just stored at the provided URL.
         */
        decoratedTemplateCache.put = function put(url) {

            // Evict old cached $templateRequest() result
            delete promiseCache[url];

            // Continue with originally-requested put() operation
            return $delegate.put.apply(this, arguments);

        };

        return decoratedTemplateCache;

    }]);

    // Decorate $templateRequest such that it automatically applies any HTML
    // patches associated with installed Guacamole extensions
    $provide.decorator('$templateRequest', ['$delegate', '$injector',
            function decorateTemplateRequest($delegate, $injector) {

        // Required services
        var $q           = $injector.get('$q');
        var patchService = $injector.get('patchService');

        /**
         * Represents a single HTML patching operation which will be applied
         * to the raw HTML of a template. The name of the patching operation
         * MUST be one of the valid names defined within
         * PatchOperation.Operations.
         *
         * @constructor
         * @param {String} name
         *     The name of the patching operation that will be applied. Valid
         *     names are defined within PatchOperation.Operations.
         *
         * @param {String} selector
         *     The CSS selector which determines which elements within a
         *     template will be affected by the patch operation.
         */
        var PatchOperation = function PatchOperation(name, selector) {

            /**
             * Applies this patch operation to the template defined by the
             * given root element, which must be a single element wrapped by
             * JQuery.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template to which
             *     this patch operation should be applied.
             *
             * @param {Element[]} elements
             *     The elements which should be applied by the patch
             *     operation. For example, if the patch operation is inserting
             *     elements, these are the elements that will be inserted.
             */
            this.apply = function apply(root, elements) {
                PatchOperation.Operations[name](root, selector, elements);
            };

        };

        /**
         * Mapping of all valid patch operation names to their corresponding
         * implementations. Each implementation accepts the same three
         * parameters: the root element of the template being patched, the CSS
         * selector determining which elements within the template are patched,
         * and an array of elements which make up the body of the patch.
         *
         * @type Object.<String, Function>
         */
        PatchOperation.Operations = {

            /**
             * Inserts the given elements before the elements matched by the
             * provided CSS selector.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'before' : function before(root, selector, elements) {
                root.find(selector).before(elements);
            },

            /**
             * Inserts the given elements after the elements matched by the
             * provided CSS selector.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'after' : function after(root, selector, elements) {
                root.find(selector).after(elements);
            },

            /**
             * Replaces the elements matched by the provided CSS selector with
             * the given elements.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'replace' : function replace(root, selector, elements) {
                root.find(selector).replaceWith(elements);
            },

            /**
             * Inserts the given elements within the elements matched by the
             * provided CSS selector, before any existing children.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'before-children' : function beforeChildren(root, selector, elements) {
                root.find(selector).prepend(elements);
            },

            /**
             * Inserts the given elements within the elements matched by the
             * provided CSS selector, after any existing children.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'after-children' : function afterChildren(root, selector, elements) {
                root.find(selector).append(elements);
            },

            /**
             * Inserts the given elements within the elements matched by the
             * provided CSS selector, replacing any existing children.
             *
             * @param {Element[]} root
             *     The JQuery-wrapped root element of the template being
             *     patched.
             *
             * @param {String} selector
             *     The CSS selector which determines where this patch operation
             *     should be applied within the template defined by root.
             *
             * @param {Element[]} elements
             *     The contents of the patch which should be applied to the
             *     template defined by root at the locations selected by the
             *     given CSS selector.
             */
            'replace-children' : function replaceChildren(root, selector, elements) {
                root.find(selector).empty().append(elements);
            }

        };

        /**
         * Applies each of the given HTML patches to the given template.
         *
         * @param {Element[]} root
         *     The JQuery-wrapped root element of the template being
         *     patched.
         *
         * @param {String[]} patches
         *     An array of all HTML patches to be applied to the given
         *     template.
         */
        var applyPatches = function applyPatches(root, patches) {

            // Apply all defined patches
            angular.forEach(patches, function applyPatch(patch) {

                var elements = $(patch);

                // Filter out and parse all applicable meta tags
                var operations = [];
                elements = elements.filter(function filterMetaTags(index, element) {

                    // Leave non-meta tags untouched
                    if (element.tagName !== 'META')
                        return true;

                    // Only meta tags having a valid "name" attribute need
                    // to be filtered
                    var name = element.getAttribute('name');
                    if (!name || !(name in PatchOperation.Operations))
                        return true;

                    // The "content" attribute must be present for any
                    // valid "name" meta tag
                    var content = element.getAttribute('content');
                    if (!content)
                        return true;

                    // Filter out and parse meta tag
                    operations.push(new PatchOperation(name, content));
                    return false;

                });

                // Apply each operation implied by the meta tags
                angular.forEach(operations, function applyOperation(operation) {
                    operation.apply(root, elements);
                });

            });

        };

        /**
         * Invokes $templateRequest() with all arguments exactly as provided,
         * applying all HTML patches from any installed Guacamole extensions
         * to the HTML of the requested template.
         *
         * @param {String} url
         *     The URL of the template being requested.
         *
         * @returns {Promise.<String>}
         *     A Promise which resolves with the patched HTML contents of the
         *     requested template if retrieval of the template is successful.
         */
        var decoratedTemplateRequest = function decoratedTemplateRequest(url) {
            
            var deferred = $q.defer();

            // Chain to cached promise if it already exists
            var cachedPromise = promiseCache[url];
            if (cachedPromise) {
                cachedPromise.then(deferred.resolve, deferred.reject);
                return deferred.promise;
            }

            // Resolve promise with patched template HTML
            $delegate.apply(this, arguments).then(function patchTemplate(data) {

                // Retrieve and apply all patches
                patchService.getPatches().then(function applyRetrievedPatches(patches) {

                    // Parse HTML into DOM tree
                    var root = $('<div></div>').html(data);

                    // Apply all HTML patches to the parsed DOM
                    applyPatches(root, patches);

                    // Transform back into HTML
                    deferred.resolve.call(this, root.html());

                }, deferred.reject);

            }, deferred.reject);

            // Cache this promise for future results
            promiseCache[url] = deferred.promise;
            return deferred.promise;

        };

        return decoratedTemplateRequest;

    }]);
}]);