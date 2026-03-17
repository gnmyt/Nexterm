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
 * TagHandler for the "connection" element.
 */
public class ConnectionTagHandler implements TagHandler {

    /**
     * The GuacamoleConfiguration backing this tag handler.
     */
    private GuacamoleConfiguration config = new GuacamoleConfiguration();

    /**
     * The name associated with the connection being parsed.
     */
    private String name;

    /**
     * The Authorization this connection belongs to.
     */
    private Authorization parent;

    /**
     * Creates a new ConnectionTagHandler that parses a Connection owned by
     * the given Authorization.
     *
     * @param parent The Authorization that will own this Connection once
     *               parsed.
     */
    public ConnectionTagHandler(Authorization parent) {
        this.parent = parent;
    }

    @Override
    public void init(Attributes attributes) throws SAXException {
        name = attributes.getValue("name");
        parent.addConfiguration(name, this.asGuacamoleConfiguration());
    }

    @Override
    public TagHandler childElement(String localName) throws SAXException {

        if (localName.equals("param"))
            return new ParamTagHandler(config);

        if (localName.equals("protocol"))
            return new ProtocolTagHandler(config);

        return null;

    }

    @Override
    public void complete(String textContent) throws SAXException {
        // Do nothing
    }

    /**
     * Returns a GuacamoleConfiguration whose contents are populated from data
     * within this connection element and child elements. This
     * GuacamoleConfiguration will continue to be modified as the user mapping
     * is parsed.
     *
     * @return A GuacamoleConfiguration whose contents are populated from data
     *         within this connection element.
     */
    public GuacamoleConfiguration asGuacamoleConfiguration() {
        return config;
    }

    /**
     * Returns the name associated with this connection.
     *
     * @return The name associated with this connection.
     */
    public String getName() {
        return name;
    }

}
