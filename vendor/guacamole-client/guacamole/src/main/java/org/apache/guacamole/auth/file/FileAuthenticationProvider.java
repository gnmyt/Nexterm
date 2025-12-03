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

import java.io.File;
import java.io.IOException;
import java.util.Map;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.simple.SimpleAuthenticationProvider;
import org.apache.guacamole.xml.DocumentHandler;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

/**
 * Authenticates users against a static list of username/password pairs.
 * Each username/password may be associated with multiple configurations.
 * This list is stored in an XML file which is reread if modified.
 */
public class FileAuthenticationProvider extends SimpleAuthenticationProvider {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(FileAuthenticationProvider.class);

    /**
     * The time the user mapping file was last modified. If the file has never
     * been read, and thus no modification time exists, this will be
     * Long.MIN_VALUE.
     */
    private long lastModified = Long.MIN_VALUE;

    /**
     * The parsed UserMapping read when the user mapping file was last parsed.
     */
    private UserMapping cachedUserMapping;

    /**
     * Guacamole server environment.
     */
    private final Environment environment = LocalEnvironment.getInstance();

    /**
     * The filename to use for the user mapping.
     */
    public static final String USER_MAPPING_FILENAME = "user-mapping.xml";
    
    @Override
    public String getIdentifier() {
        return "default";
    }

    /**
     * Returns a UserMapping containing all authorization data given within
     * GUACAMOLE_HOME/user-mapping.xml. If the XML file has been modified or has
     * not yet been read, this function may reread the file.
     *
     * @return
     *     A UserMapping containing all authorization data within the user
     *     mapping XML file, or null if the file cannot be found/parsed.
     */
    private UserMapping getUserMapping() {

        // Read user mapping from GUACAMOLE_HOME/user-mapping.xml
        File userMappingFile = new File(environment.getGuacamoleHome(), USER_MAPPING_FILENAME);

        // Abort if user mapping does not exist
        if (!userMappingFile.exists()) {
            logger.debug("User mapping file \"{}\" does not exist and will not be read.", userMappingFile);
            return null;
        }

        // Refresh user mapping if file has changed
        if (lastModified < userMappingFile.lastModified()) {

            logger.debug("Reading user mapping file: \"{}\"", userMappingFile);

            // Set up XML parser
            SAXParser parser;
            try {
                parser = SAXParserFactory.newInstance().newSAXParser();
            }
            catch (ParserConfigurationException e) {
                logger.error("Unable to create XML parser for reading \"{}\": {}", USER_MAPPING_FILENAME, e.getMessage());
                logger.debug("An instance of SAXParser could not be created.", e);
                return null;
            }
            catch (SAXException e) {
                logger.error("Unable to create XML parser for reading \"{}\": {}", USER_MAPPING_FILENAME, e.getMessage());
                logger.debug("An instance of SAXParser could not be created.", e);
                return null;
            }

            // Parse document
            try {

                // Get handler for root element
                UserMappingTagHandler userMappingHandler =
                        new UserMappingTagHandler();

                // Set up document handler
                DocumentHandler contentHandler = new DocumentHandler(
                        "user-mapping", userMappingHandler);

                // Read and parse file
                parser.parse(userMappingFile, contentHandler);

                // Store mod time and user mapping
                lastModified = userMappingFile.lastModified();
                cachedUserMapping = userMappingHandler.asUserMapping();

            }

            // If the file is unreadable, return no mapping
            catch (IOException e) {
                logger.warn("Unable to read user mapping file \"{}\": {}", userMappingFile, e.getMessage());
                logger.debug("Error reading user mapping file.", e);
                return null;
            }

            // If the file cannot be parsed, return no mapping
            catch (SAXException e) {
                logger.warn("User mapping file \"{}\" is not valid: {}", userMappingFile, e.getMessage());
                logger.debug("Error parsing user mapping file.", e);
                return null;
            }

        }

        // Return (possibly cached) user mapping
        return cachedUserMapping;

    }

    @Override
    public Map<String, GuacamoleConfiguration>
            getAuthorizedConfigurations(Credentials credentials)
            throws GuacamoleException {

        // Abort authorization if no user mapping exists
        UserMapping userMapping = getUserMapping();
        if (userMapping == null)
            return null;

        // Validate and return info for given user and pass
        Authorization auth = userMapping.getAuthorization(credentials.getUsername());
        if (auth != null && auth.validate(credentials.getUsername(), credentials.getPassword()))
            return auth.getConfigurations();

        // Unauthorized
        return null;

    }

}
