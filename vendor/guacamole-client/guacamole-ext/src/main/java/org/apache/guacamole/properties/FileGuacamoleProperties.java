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

package org.apache.guacamole.properties;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * GuacamoleProperties implementation which reads all properties from a
 * standard Java properties file. Whitespace at the end of property values is
 * automatically trimmed.
 */
public class FileGuacamoleProperties extends PropertiesGuacamoleProperties {

    /**
     * Reads the given Java properties file, storing all property name/value
     * pairs in a new {@link Properties} object.
     *
     * @param propertiesFile
     *     The Java properties file to read.
     *
     * @return
     *     A new Properties containing all property name/value pairs defined in
     *     the given file.
     *
     * @throws GuacamoleException
     *     If an error prevents reading the given Java properties file.
     */
    private static Properties read(File propertiesFile) throws GuacamoleException {

        // Fail early if file simply does not exist
        if (!propertiesFile.exists())
            throw new GuacamoleServerException(String.format("\"%s\" does not "
                    + "exist.", propertiesFile));

        // Load properties from stream, if any, always closing stream when done
        Properties properties = new Properties();
        try (InputStream stream = new FileInputStream(propertiesFile)) {
            properties.load(stream);
        }
        catch (IOException e) {
            throw new GuacamoleServerException(String.format("\"%s\" cannot "
                    + "be read: %s", propertiesFile, e.getMessage()), e);
        }

        return properties;
        
    }

    /**
     * Creates a new FileGuacamoleProperties which reads all properties from
     * the given standard Java properties file.
     *
     * @param propertiesFile
     *     The Java properties file to read.
     *
     * @throws GuacamoleException
     *     If an error prevents reading the given Java properties file.
     */
    public FileGuacamoleProperties(File propertiesFile) throws GuacamoleException {
        super(read(propertiesFile));
    }

}
