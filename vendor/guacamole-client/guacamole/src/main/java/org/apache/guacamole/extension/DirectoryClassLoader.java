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

package org.apache.guacamole.extension;

import java.io.File;
import java.io.FilenameFilter;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.Collection;
import org.apache.guacamole.GuacamoleException;

/**
 * A ClassLoader implementation which finds classes within .jar files within a
 * given directory.
 */
public class DirectoryClassLoader extends URLClassLoader {

    /**
     * Returns all .jar files within the given directory as an array of URLs.
     *
     * @param dir
     *     The directory to retrieve all .jar files from.
     *
     * @return
     *     An array of the URLs of all .jar files within the given directory.
     *
     * @throws GuacamoleException
     *     If the given file is not a directory, or the contents of the given
     *     directory cannot be read.
     */
    private static URL[] getJarURLs(File dir) throws GuacamoleException {

        // Validate directory is indeed a directory
        if (!dir.isDirectory())
            throw new GuacamoleException(dir + " is not a directory.");

        // Get list of URLs for all .jar's in the lib directory
        Collection<URL> jarURLs = new ArrayList<URL>();
        File[] files = dir.listFiles(new FilenameFilter() {

            @Override
            public boolean accept(File dir, String name) {

                // If it ends with .jar, accept the file
                return name.endsWith(".jar");

            }

        });

        // Verify directory was successfully read
        if (files == null)
            throw new GuacamoleException("Unable to read contents of directory " + dir);

        // Add the URL for each .jar to the jar URL list
        for (File file : files) {

            try {
                jarURLs.add(file.toURI().toURL());
            }
            catch (MalformedURLException e) {
                throw new GuacamoleException(e);
            }

        }

        // Set delegate classloader to new URLClassLoader which loads from the .jars found above.
        URL[] urls = new URL[jarURLs.size()];
        return jarURLs.toArray(urls);

    }

    /**
     * Creates a new DirectoryClassLoader configured to load .jar files from
     * the given directory.
     *
     * @param dir
     *     The directory from which .jar files should be read.
     *
     * @throws GuacamoleException
     *     If the given file is not a directory, or the contents of the given
     *     directory cannot be read.
     */

    public DirectoryClassLoader(File dir) throws GuacamoleException {
        super(getJarURLs(dir), DirectoryClassLoader.class.getClassLoader());
    }

}
