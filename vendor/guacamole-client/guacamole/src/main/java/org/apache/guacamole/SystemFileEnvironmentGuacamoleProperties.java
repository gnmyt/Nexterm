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

package org.apache.guacamole;

import com.google.common.io.Files;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.apache.guacamole.properties.GuacamoleProperties;
import org.apache.guacamole.token.TokenName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * GuacamoleProperties implementation which reads all properties from files
 * whose filenames are stored in environment variables. The name of the
 * environment variable corresponding to the filename is determined from the
 * original property using {@link TokenName#canonicalize(java.lang.String)}
 * with an additional "_FILE" suffix.
 */
public class SystemFileEnvironmentGuacamoleProperties implements GuacamoleProperties {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(SystemFileEnvironmentGuacamoleProperties.class);

    @Override
    public String getProperty(String name) {

        String filename = System.getenv(TokenName.canonicalize(name) + "_FILE");
        if (filename != null) {
            try {
                return Files.asCharSource(new File(filename), StandardCharsets.UTF_8).read();
            }
            catch (IOException e) {
                logger.error("Property \"{}\" could not be read from file \"{}\": {}", name, filename, e.getMessage());
                logger.debug("Error reading property value from file.", e);
            }
        }

        return null;

    }

}

