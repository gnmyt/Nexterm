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
 * TagHandler for the "param" element.
 */
public class ParamTagHandler implements TagHandler {

    /**
     * The GuacamoleConfiguration which will be populated with data from
     * the tag handled by this tag handler.
     */
    private GuacamoleConfiguration config;

    /**
     * The name of the parameter.
     */
    private String name;

    /**
     * Creates a new handler for an "param" tag having the given
     * attributes.
     *
     * @param config The GuacamoleConfiguration to update with the data parsed
     *               from the "protocol" tag.
     */
    public ParamTagHandler(GuacamoleConfiguration config) {
        this.config = config;
    }

    @Override
    public void init(Attributes attributes) throws SAXException {
        this.name = attributes.getValue("name");
    }

    @Override
    public TagHandler childElement(String localName) throws SAXException {
        throw new SAXException("The 'param' tag can contain no elements.");
    }

    @Override
    public void complete(String textContent) throws SAXException {
        config.setParameter(name, textContent);
    }

}
