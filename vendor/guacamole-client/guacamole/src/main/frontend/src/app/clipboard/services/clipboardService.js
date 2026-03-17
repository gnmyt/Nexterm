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
 * A service for maintaining and accessing clipboard data. If possible, this
 * service will leverage the local clipboard. If the local clipboard is not
 * available, an internal in-memory clipboard will be used instead.
 */
angular.module('clipboard').factory('clipboardService', ['$injector',
        function clipboardService($injector) {

    // Get required services
    const $q                    = $injector.get('$q');
    const $window               = $injector.get('$window');
    const $rootScope            = $injector.get('$rootScope');
    const sessionStorageFactory = $injector.get('sessionStorageFactory');

    // Required types
    const ClipboardData = $injector.get('ClipboardData');

    /**
     * Getter/setter which retrieves or sets the current stored clipboard
     * contents. The stored clipboard contents are strictly internal to
     * Guacamole, and may not reflect the local clipboard if local clipboard
     * access is unavailable.
     *
     * @type Function
     */
    const storedClipboardData = sessionStorageFactory.create(new ClipboardData());

    var service = {};

    /**
     * The amount of time to wait before actually serving a request to read
     * clipboard data, in milliseconds. Providing a reasonable delay between
     * request and read attempt allows the cut/copy operation to settle, in
     * case the data we are anticipating to be present is not actually present
     * in the clipboard yet.
     *
     * @constant
     * @type Number
     */
    var CLIPBOARD_READ_DELAY = 100;

    /**
     * The promise associated with the current pending clipboard read attempt.
     * If no clipboard read is active, this will be null.
     *
     * @type Promise.<ClipboardData>
     */
    var pendingRead = null;

    /**
     * Reference to the window.document object.
     *
     * @private
     * @type HTMLDocument
     */
    var document = $window.document;

    /**
     * The textarea that will be used to hold the local clipboard contents.
     *
     * @type Element
     */
    var clipboardContent = document.createElement('textarea');

    // Ensure clipboard target is selectable but not visible
    clipboardContent.className = 'clipboard-service-target';

    // Add clipboard target to DOM
    document.body.appendChild(clipboardContent);

    /**
     * Stops the propagation of the given event through the DOM tree. This is
     * identical to invoking stopPropagation() on the event directly, except
     * that this function is usable as an event handler itself.
     *
     * @param {Event} e
     *     The event whose propagation through the DOM tree should be stopped.
     */
    var stopEventPropagation = function stopEventPropagation(e) {
        e.stopPropagation();
    };

    // Prevent events generated due to execCommand() from disturbing external things
    clipboardContent.addEventListener('cut',   stopEventPropagation);
    clipboardContent.addEventListener('copy',  stopEventPropagation);
    clipboardContent.addEventListener('paste', stopEventPropagation);
    clipboardContent.addEventListener('input', stopEventPropagation);

    /**
     * A stack of past node selection ranges. A range convering the nodes
     * currently selected within the document can be pushed onto this stack
     * with pushSelection(), and the most recently pushed selection can be
     * popped off the stack (and thus re-selected) with popSelection().
     *
     * @type Range[]
     */
    var selectionStack = [];

    /**
     * Pushes the current selection range to the selection stack such that it
     * can later be restored with popSelection().
     */
    var pushSelection = function pushSelection() {

        // Add a range representing the current selection to the stack
        var selection = $window.getSelection();
        if (selection.getRangeAt && selection.rangeCount)
            selectionStack.push(selection.getRangeAt(0));

    };

    /**
     * Pops a selection range off the selection stack restoring the document's
     * previous selection state. The selection range will be the most recent
     * selection range pushed by pushSelection(). If there are no selection
     * ranges currently on the stack, this function has no effect.
     */
    var popSelection = function popSelection() {

        // Pull one selection range from the stack
        var range = selectionStack.pop();
        if (!range)
            return;

        // Replace any current selection with the retrieved selection
        var selection = $window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

    };

    /**
     * Selects all nodes within the given element. This will replace the
     * current selection with a new selection range that covers the element's
     * contents. If the original selection should be preserved, use
     * pushSelection() and popSelection().
     *
     * @param {Element} element
     *     The element whose contents should be selected.
     */
    var selectAll = function selectAll(element) {

        // Use the select() function defined for input elements, if available
        if (element.select)
            element.select();

        // Fallback to manual manipulation of the selection
        else {

            // Generate a range which selects all nodes within the given element
            var range = document.createRange();
            range.selectNodeContents(element);

            // Replace any current selection with the generated range
            var selection = $window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

        }

    };

    /**
     * Sets the local clipboard, if possible, to the given text.
     *
     * @param {ClipboardData} data
     *     The data to assign to the local clipboard should be set.
     *
     * @return {Promise}
     *     A promise that will resolve if setting the clipboard was successful,
     *     and will reject if it failed.
     */
    const setLocalClipboard = function setLocalClipboard(data) {

        var deferred = $q.defer();

        try {

            // Attempt to read the clipboard using the Asynchronous Clipboard
            // API, if it's available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                if (data.type === 'text/plain') {
                    navigator.clipboard.writeText(data.data).then(deferred.resolve, deferred.reject);
                    return deferred.promise;
                }
            }

        }

        // Ignore any hard failures to use Asynchronous Clipboard API, falling
        // back to traditional document.execCommand()
        catch (ignore) {}

        // Track the originally-focused element prior to changing focus
        var originalElement = document.activeElement;
        pushSelection();

        // Copy the given value into the clipboard DOM element
        if (typeof data.data === 'string')
            clipboardContent.value = data.data;
        else {
            clipboardContent.innerHTML = '';
            var img = document.createElement('img');
            img.src = URL.createObjectURL(data.data);
            clipboardContent.appendChild(img);
        }

        // Select all data within the clipboard target
        clipboardContent.focus();
        selectAll(clipboardContent);

        // Attempt to copy data from clipboard element into local clipboard
        if (document.execCommand('copy'))
            deferred.resolve();
        else
            deferred.reject();

        // Unfocus the clipboard DOM event to avoid mobile keyboard opening,
        // restoring whichever element was originally focused
        clipboardContent.blur();
        originalElement.focus();
        popSelection();

        return deferred.promise;
    };

    /**
     * Parses the given data URL, returning its decoded contents as a new Blob.
     * If the URL is not a valid data URL, null will be returned instead.
     *
     * @param {String} url
     *     The data URL to parse.
     *
     * @returns {Blob}
     *     A new Blob containing the decoded contents of the data URL, or null
     *     if the URL is not a valid data URL.
     */
    service.parseDataURL = function parseDataURL(url) {

        // Parse given string as a data URL
        var result = /^data:([^;]*);base64,([a-zA-Z0-9+/]*[=]*)$/.exec(url);
        if (!result)
            return null;

        // Pull the mimetype and base64 contents of the data URL
        var type = result[1];
        var data = $window.atob(result[2]);

        // Convert the decoded binary string into a typed array
        var buffer = new Uint8Array(data.length);
        for (var i = 0; i < data.length; i++)
            buffer[i] = data.charCodeAt(i);

        // Produce a proper blob containing the data and type provided in
        // the data URL
        return new Blob([buffer], { type : type });

    };

    /**
     * Returns the content of the given element as plain, unformatted text,
     * preserving only individual characters and newlines. Formatting, images,
     * etc. are not taken into account.
     *
     * @param {Element} element
     *     The element whose text content should be returned.
     *
     * @returns {String}
     *     The plain text contents of the given element, including newlines and
     *     spacing but otherwise without any formatting.
     */
    service.getTextContent = function getTextContent(element) {

        var blocks = [];
        var currentBlock = '';

        // For each child of the given element
        var current = element.firstChild;
        while (current) {

            // Simply append the content of any text nodes
            if (current.nodeType === Node.TEXT_NODE)
                currentBlock += current.nodeValue;

            // Render <br> as a newline character
            else if (current.nodeName === 'BR')
                currentBlock += '\n';

            // Render <img> as alt text, if available
            else if (current.nodeName === 'IMG')
                currentBlock += current.getAttribute('alt') || '';

            // For all other nodes, handling depends on whether they are
            // block-level elements
            else {

                // If we are entering a new block context, start a new block if
                // the current block is non-empty
                if (currentBlock.length && $window.getComputedStyle(current).display === 'block') {

                    // Trim trailing newline (would otherwise inflate the line count by 1)
                    if (currentBlock.substring(currentBlock.length - 1) === '\n')
                        currentBlock = currentBlock.substring(0, currentBlock.length - 1);

                    // Finish current block and start a new block
                    blocks.push(currentBlock);
                    currentBlock = '';

                }

                // Append the content of the current element to the current block
                currentBlock += service.getTextContent(current);

            }

            current = current.nextSibling;

        }

        // Add any in-progress block
        if (currentBlock.length)
            blocks.push(currentBlock);

        // Combine all non-empty blocks, separated by newlines
        return blocks.join('\n');

    };

    /**
     * Replaces the current text content of the given element with the given
     * text. To avoid affecting the position of the cursor within an editable
     * element, or firing unnecessary DOM modification events, the underlying
     * <code>textContent</code> property of the element is only touched if
     * doing so would actually change the text.
     *
     * @param {Element} element
     *     The element whose text content should be changed.
     *
     * @param {String} text
     *     The text content to assign to the given element.
     */
    service.setTextContent = function setTextContent(element, text) {

        // Strip out any images
        $(element).find('img').remove();

        // Reset text content only if doing so will actually change the content
        if (service.getTextContent(element) !== text)
            element.textContent = text;

    };

    /**
     * Returns the URL of the single image within the given element, if the
     * element truly contains only one child and that child is an image. If the
     * content of the element is mixed or not an image, null is returned.
     *
     * @param {Element} element
     *     The element whose image content should be retrieved.
     *
     * @returns {String}
     *     The URL of the image contained within the given element, if that
     *     element contains only a single child element which happens to be an
     *     image, or null if the content of the element is not purely an image.
     */
    service.getImageContent = function getImageContent(element) {

        // Return the source of the single child element, if it is an image
        var firstChild = element.firstChild;
        if (firstChild && firstChild.nodeName === 'IMG' && !firstChild.nextSibling)
            return firstChild.getAttribute('src');

        // Otherwise, the content of this element is not simply an image
        return null;

    };

    /**
     * Replaces the current contents of the given element with a single image
     * having the given URL. To avoid affecting the position of the cursor
     * within an editable element, or firing unnecessary DOM modification
     * events, the content of the element is only touched if doing so would
     * actually change content.
     *
     * @param {Element} element
     *     The element whose image content should be changed.
     *
     * @param {String} url
     *     The URL of the image which should be assigned as the contents of the
     *     given element.
     */
    service.setImageContent = function setImageContent(element, url) {

        // Retrieve the URL of the current image contents, if any
        var currentImage = service.getImageContent(element);

        // If the current contents are not the given image (or not an image
        // at all), reassign the contents
        if (currentImage !== url) {

            // Clear current contents
            element.innerHTML = '';

            // Add a new image as the sole contents of the element
            var img = document.createElement('img');
            img.src = url;
            element.appendChild(img);

        }

    };

    /**
     * Get the current value of the local clipboard.
     *
     * @return {Promise.<ClipboardData>}
     *     A promise that will resolve with the contents of the local clipboard
     *     if getting the clipboard was successful, and will reject if it
     *     failed.
     */
    const getLocalClipboard = function getLocalClipboard() {

        // If the clipboard is already being read, do not overlap the read
        // attempts; instead share the result across all requests
        if (pendingRead)
            return pendingRead;

        var deferred = $q.defer();

        try {

            // Attempt to read the clipboard using the Asynchronous Clipboard
            // API, if it's available
            if (navigator.clipboard && navigator.clipboard.readText) {

                navigator.clipboard.readText().then(function textRead(text) {
                    deferred.resolve(new ClipboardData({
                        type : 'text/plain',
                        data : text
                    }));
                }, deferred.reject);

                return deferred.promise;

            }

        }

        // Ignore any hard failures to use Asynchronous Clipboard API, falling
        // back to traditional document.execCommand()
        catch (ignore) {}

        // Track the originally-focused element prior to changing focus
        var originalElement = document.activeElement;

        /**
         * Attempts to paste the clipboard contents into the
         * currently-focused element. The promise related to the current
         * attempt to read the clipboard will be resolved or rejected
         * depending on whether the attempt to paste succeeds.
         */
        var performPaste = function performPaste() {

            // Attempt paste local clipboard into clipboard DOM element
            if (document.execCommand('paste')) {

                // If the pasted data is a single image, resolve with a blob
                // containing that image
                var currentImage = service.getImageContent(clipboardContent);
                if (currentImage) {

                    // Convert the image's data URL into a blob
                    var blob = service.parseDataURL(currentImage);
                    if (blob) {
                        deferred.resolve(new ClipboardData({
                            type : blob.type,
                            data : blob
                        }));
                    }

                    // Reject if conversion fails
                    else
                        deferred.reject();

                } // end if clipboard is an image

                // Otherwise, assume the clipboard contains plain text
                else
                    deferred.resolve(new ClipboardData({
                        type : 'text/plain',
                        data : clipboardContent.value
                    }));

            }

            // Otherwise, reading from the clipboard has failed
            else
                deferred.reject();

        };

        // Mark read attempt as in progress, cleaning up event listener and
        // selection once the paste attempt has completed
        pendingRead = deferred.promise['finally'](function cleanupReadAttempt() {

            // Do not use future changes in focus
            clipboardContent.removeEventListener('focus', performPaste);

            // Unfocus the clipboard DOM event to avoid mobile keyboard opening,
            // restoring whichever element was originally focused
            clipboardContent.blur();
            originalElement.focus();
            popSelection();

            // No read is pending any longer
            pendingRead = null;

        });

        // Wait for the next event queue run before attempting to read
        // clipboard data (in case the copy/cut has not yet completed)
        $window.setTimeout(function deferredClipboardRead() {

            pushSelection();

            // Ensure clipboard element is blurred (and that the "focus" event
            // will fire)
            clipboardContent.blur();
            clipboardContent.addEventListener('focus', performPaste);

            // Clear and select the clipboard DOM element
            clipboardContent.value = '';
            clipboardContent.focus();
            selectAll(clipboardContent);

            // If focus failed to be set, we cannot read the clipboard
            if (document.activeElement !== clipboardContent)
                deferred.reject();

        }, CLIPBOARD_READ_DELAY);

        return pendingRead;

    };

    /**
     * Returns the current value of the internal clipboard shared across all
     * active Guacamole connections running within the current browser tab. If
     * access to the local clipboard is available, the internal clipboard is
     * first synchronized with the current local clipboard contents. If access
     * to the local clipboard is unavailable, only the internal clipboard will
     * be used.
     *
     * @return {Promise.<ClipboardData>}
     *     A promise that will resolve with the contents of the internal
     *     clipboard, first retrieving those contents from the local clipboard
     *     if permission to do so has been granted. This promise is always
     *     resolved.
     */
    service.getClipboard = function getClipboard() {
        return getLocalClipboard().then((data) => storedClipboardData(data), () => storedClipboardData());
    };

    /**
     * Sets the content of the internal clipboard shared across all active
     * Guacamole connections running within the current browser tab. If
     * access to the local clipboard is available, the local clipboard is
     * first set to the provided clipboard content. If access to the local
     * clipboard is unavailable, only the internal clipboard will be used. A
     * "guacClipboard" event will be broadcast with the assigned data once the
     * operation has completed.
     *
     * @param {ClipboardData} data
     *     The data to assign to the clipboard.
     *
     * @return {Promise}
     *     A promise that will resolve after the clipboard content has been
     *     set. This promise is always resolved.
     */
    service.setClipboard = function setClipboard(data) {
        return setLocalClipboard(data)['catch'](angular.noop).finally(() => {

            // Update internal clipboard and broadcast event notifying of
            // updated contents
            storedClipboardData(data);
            $rootScope.$broadcast('guacClipboard', data);

        });
    };

    /**
     * Resynchronizes the local and internal clipboards, setting the contents
     * of the internal clipboard to that of the local clipboard (if local
     * clipboard access is granted) and broadcasting a "guacClipboard" event
     * with the current internal clipboard contents for consumption by external
     * components like the "guacClient" directive.
     */
    service.resyncClipboard = function resyncClipboard() {
        getLocalClipboard().then(function clipboardRead(data) {
            return service.setClipboard(data);
        }, angular.noop);
    };

    return service;

}]);
