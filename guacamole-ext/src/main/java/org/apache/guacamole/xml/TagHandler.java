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

package org.apache.guacamole.xml;

import org.xml.sax.Attributes;
import org.xml.sax.SAXException;

/**
 * A simple element-level event handler for events triggered by the
 * SAX-driven DocumentHandler parser.
 */
public interface TagHandler {

    /**
     * Called when a child element of the current element is parsed.
     *
     * @param localName The local name of the child element seen.
     * @return The TagHandler which should handle all element-level events
     *         related to the child element.
     * @throws SAXException If the child element being parsed was not expected,
     *                      or some other error prevents a proper TagHandler
     *                      from being constructed for the child element.
     */
    public TagHandler childElement(String localName)
            throws SAXException;

    /**
     * Called when the element corresponding to this TagHandler is first seen,
     * just after an instance is created.
     *
     * @param attributes The attributes of the element seen.
     * @throws SAXException If an error prevents a the TagHandler from being
     *                      from being initialized.
     */
    public void init(Attributes attributes) throws SAXException;

    /**
     * Called when this element, and all child elements, have been fully parsed,
     * and the entire text content of this element (if any) is available.
     *
     * @param textContent The full text content of this element, if any.
     * @throws SAXException If the text content received is not valid for any
     *                      reason, or the child elements parsed are not
     *                      correct.
     */
    public void complete(String textContent) throws SAXException;

}
