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
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;

/**
 * TagHandler for the "user-mapping" element.
 */
public class UserMappingTagHandler implements TagHandler {

    /**
     * The UserMapping which will contain all data parsed by this tag handler.
     */
    private UserMapping user_mapping = new UserMapping();

    @Override
    public void init(Attributes attributes) throws SAXException {
        // Do nothing
    }

    @Override
    public TagHandler childElement(String localName) throws SAXException {

        // Start parsing of authorize tags, add to list of all authorizations
        if (localName.equals("authorize"))
            return new AuthorizeTagHandler(user_mapping);

        return null;

    }

    @Override
    public void complete(String textContent) throws SAXException {
        // Do nothing
    }

    /**
     * Returns a user mapping containing all authorizations and configurations
     * parsed so far. This user mapping will be backed by the data being parsed,
     * thus any additional authorizations or configurations will be available
     * in the object returned by this function even after this function has
     * returned, once the data corresponding to those authorizations or
     * configurations has been parsed.
     *
     * @return A user mapping containing all authorizations and configurations
     *         parsed so far.
     */
    public UserMapping asUserMapping() {
        return user_mapping;
    }

}
