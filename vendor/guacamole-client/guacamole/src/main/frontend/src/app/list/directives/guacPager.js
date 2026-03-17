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
 * A directive which provides pagination controls, along with a paginated
 * subset of the elements of some given array.
 */
angular.module('list').directive('guacPager', [function guacPager() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The property to which a subset of the provided array will be
             * assigned.
             *
             * @type Array
             */
            page : '=',

            /**
             * The maximum number of items per page.
             *
             * @type Number
             */
            pageSize : '&',

            /**
             * The maximum number of page choices to provide, regardless of the
             * total number of pages.
             *
             * @type Number
             */
            pageCount : '&',

            /**
             * An array objects to paginate. Subsets of this array will be
             * exposed as pages.
             *
             * @type Array
             */
            items : '&'

        },

        templateUrl: 'app/list/templates/guacPager.html',
        controller: ['$scope', function guacPagerController($scope) {

            /**
             * The default size of a page, if not provided via the pageSize
             * attribute.
             *
             * @type Number
             */
            var DEFAULT_PAGE_SIZE = 10;

            /**
             * The default maximum number of page choices to provide, if a
             * value is not providede via the pageCount attribute.
             *
             * @type Number
             */
            var DEFAULT_PAGE_COUNT = 11;

            /**
             * An array of arrays, where the Nth array contains the contents of
             * the Nth page.
             *
             * @type Array[]
             */
            var pages = [];

            /**
             * The number of the first selectable page.
             *
             * @type Number;
             */
            $scope.firstPage = 1;

            /**
             * The number of the page immediately before the currently-selected
             * page.
             *
             * @type Number;
             */
            $scope.previousPage = 1;

            /**
             * The number of the currently-selected page.
             *
             * @type Number;
             */
            $scope.currentPage = 1;

            /**
             * The number of the page immediately after the currently-selected
             * page.
             *
             * @type Number;
             */
            $scope.nextPage = 1;

            /**
             * The number of the last selectable page.
             *
             * @type Number;
             */
            $scope.lastPage = 1;

            /**
             * An array of relevant page numbers that the user may want to jump
             * to directly.
             *
             * @type Number[]
             */
            $scope.pageNumbers = [];

            /**
             * Updates the displayed page number choices.
             */
            var updatePageNumbers = function updatePageNumbers() {

                // Get page count
                var pageCount = $scope.pageCount() || DEFAULT_PAGE_COUNT;

                // Determine start/end of page window
                var windowStart = $scope.currentPage - (pageCount - 1) / 2;
                var windowEnd   = windowStart + pageCount - 1;

                // Shift window as necessary if it extends beyond the first page
                if (windowStart < $scope.firstPage) {
                    windowEnd = Math.min($scope.lastPage, windowEnd - windowStart + $scope.firstPage);
                    windowStart = $scope.firstPage;
                }

                // Shift window as necessary if it extends beyond the last page
                else if (windowEnd > $scope.lastPage) {
                    windowStart = Math.max(1, windowStart - windowEnd + $scope.lastPage);
                    windowEnd = $scope.lastPage;
                }

                // Generate list of relevant page numbers
                $scope.pageNumbers = [];
                for (var pageNumber = windowStart; pageNumber <= windowEnd; pageNumber++)
                    $scope.pageNumbers.push(pageNumber);

            };

            /**
             * Iterates through the bound items array, splitting it into pages
             * based on the current page size.
             */
            var updatePages = function updatePages() {

                // Get current items and page size
                var items = $scope.items();
                var pageSize = $scope.pageSize() || DEFAULT_PAGE_SIZE;

                // Clear current pages
                pages = [];

                // Only split into pages if items actually exist
                if (items) {

                    // Split into pages of pageSize items each
                    for (var i = 0; i < items.length; i += pageSize)
                        pages.push(items.slice(i, i + pageSize));

                }

                // Update minimum and maximum values
                $scope.firstPage = 1;
                $scope.lastPage  = pages.length;

                // Select an appropriate page
                var adjustedCurrentPage = Math.min($scope.lastPage, Math.max($scope.firstPage, $scope.currentPage));
                $scope.selectPage(adjustedCurrentPage);

            };

            /**
             * Selects the page having the given number, assigning that page to
             * the property bound to the page attribute. If no such page
             * exists, the property will be set to undefined instead. Valid
             * page numbers begin at 1.
             *
             * @param {Number} page
             *     The number of the page to select. Valid page numbers begin
             *     at 1.
             */
            $scope.selectPage = function selectPage(page) {

                // Select the chosen page
                $scope.currentPage = page;
                $scope.page = pages[page-1];

                // Update next/previous page numbers
                $scope.nextPage     = Math.min($scope.lastPage,  $scope.currentPage + 1);
                $scope.previousPage = Math.max($scope.firstPage, $scope.currentPage - 1);

                // Update which page numbers are shown
                updatePageNumbers();

            };

            /**
             * Returns whether the given page number can be legally selected
             * via selectPage(), resulting in a different page being shown.
             *
             * @param {Number} page
             *     The page number to check.
             *
             * @returns {Boolean}
             *     true if the page having the given number can be selected,
             *     false otherwise.
             */
            $scope.canSelectPage = function canSelectPage(page) {
                return page !== $scope.currentPage
                    && page >=  $scope.firstPage
                    && page <=  $scope.lastPage;
            };

            /**
             * Returns whether the page having the given number is currently
             * selected.
             *
             * @param {Number} page
             *     The page number to check.
             *
             * @returns {Boolean}
             *     true if the page having the given number is currently
             *     selected, false otherwise.
             */
            $scope.isSelected = function isSelected(page) {
                return page === $scope.currentPage;
            };

            /**
             * Returns whether pages exist before the first page listed in the
             * pageNumbers array.
             *
             * @returns {Boolean}
             *     true if pages exist before the first page listed in the
             *     pageNumbers array, false otherwise.
             */
            $scope.hasMorePagesBefore = function hasMorePagesBefore() {
                var firstPageNumber = $scope.pageNumbers[0];
                return firstPageNumber !== $scope.firstPage;
            };

            /**
             * Returns whether pages exist after the last page listed in the
             * pageNumbers array.
             *
             * @returns {Boolean}
             *     true if pages exist after the last page listed in the
             *     pageNumbers array, false otherwise.
             */
            $scope.hasMorePagesAfter = function hasMorePagesAfter() {
                var lastPageNumber = $scope.pageNumbers[$scope.pageNumbers.length - 1];
                return lastPageNumber !== $scope.lastPage;
            };

            // Update available pages when available items are changed
            $scope.$watchCollection($scope.items, function itemsChanged() {
                updatePages();
            });

            // Update available pages when page size is changed
            $scope.$watch($scope.pageSize, function pageSizeChanged() {
                updatePages();
            });

            // Update available page numbers when page count is changed
            $scope.$watch($scope.pageCount, function pageCountChanged() {
                updatePageNumbers();
            });

        }]

    };
}]);
