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

package org.apache.guacamole.auth.file;

import org.apache.guacamole.xml.TagHandler;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;

/**
 * TagHandler for the "protocol" element.
 */
public class ProtocolTagHandler implements TagHandler {

    /**
     * The GuacamoleConfiguration which will be populated with data from
     * the tag handled by this tag handler.
     */
    private GuacamoleConfiguration config;

    /**
     * Creates a new handler for a "protocol" tag having the given
     * attributes.
     *
     * @param config The GuacamoleConfiguration to update with the data parsed
     *               from the "protocol" tag.
     * @throws SAXException If the attributes given are not valid.
     */
    public ProtocolTagHandler(GuacamoleConfiguration config) throws SAXException {
        this.config = config;
    }

    @Override
    public void init(Attributes attributes) throws SAXException {
        // Do nothing
    }

    @Override
    public TagHandler childElement(String localName) throws SAXException {
        throw new SAXException("The 'protocol' tag can contain no elements.");
    }

    @Override
    public void complete(String textContent) throws SAXException {
        config.setProtocol(textContent);
    }

}
