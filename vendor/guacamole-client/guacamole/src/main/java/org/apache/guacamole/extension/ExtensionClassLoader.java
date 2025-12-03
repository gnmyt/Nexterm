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
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ClassLoader implementation which prioritizes the classes defined within a
 * given extension .jar file. Unlike the standard URLClassLoader, classes
 * within the parent ClassLoader are only used if they are not defined within
 * the given .jar. If classes are defined in both the parent and the extension
 * .jar, the versions defined within the extension .jar are used.
 */
public class ExtensionClassLoader extends URLClassLoader {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ExtensionClassLoader.class);

    /**
     * The prefix that should be given to the temporary directory containing
     * all library .jar files that were bundled with the extension.
     */
    private static final String EXTENSION_TEMP_DIR_PREFIX = "guac-extension-lib-";

    /**
     * The prefix that should be given to any files created for temporary
     * storage of a library .jar file that was bundled with the extension.
     */
    private static final String EXTENSION_TEMP_LIB_PREFIX = "bundled-";

    /**
     * The ClassLoader to use if class resolution through the extension .jar
     * fails.
     */
    private final ClassLoader parent;

    /**
     * Returns the URL that refers to the given file. If the given file refers
     * to a directory, an exception is thrown.
     *
     * @param file
     *     The file to determine the URL of.
     *
     * @return
     *     A URL that refers to the given file.
     *
     * @throws GuacamoleException
     *     If the given file refers to a directory.
     */
    private static URL getFileURL(File file) throws GuacamoleException {

        // Validate extension-related file is indeed a file
        if (!file.isFile())
            throw new GuacamoleServerException("\"" + file + "\" is not a file.");

        try {
            return file.toURI().toURL();
        }
        catch (MalformedURLException e) {
            throw new GuacamoleServerException(e);
        }

    }

    /**
     * Copies all bytes of data from a file within a .jar to a destination
     * file.
     * 
     * @param jar
     *     The JarFile containing the file to be copied.
     *
     * @param source
     *     The JarEntry representing the file to be copied within the given
     *     JarFile.
     *
     * @param dest
     *     The destination file that the data should be copied to.
     *
     * @throws IOException
     *     If an error occurs reading from the source .jar or writing to the
     *     destination file.
     */
    private static void copyEntryToFile(JarFile jar, JarEntry source, File dest)
            throws IOException {

        int length;
        byte[] buffer = new byte[8192];

        try (InputStream input = jar.getInputStream(source)) {
            try (OutputStream output = new FileOutputStream(dest)) {

                while ((length = input.read(buffer)) > 0) {
                    output.write(buffer, 0, length);
                }

            }
        }

    }
    
    /**
     * Returns the URLs for the .jar files relevant to the given extension .jar
     * file. Unless the extension bundles additional Java libraries, only the
     * URL of the extension .jar will be returned. If additional Java libraries
     * are bundled within the extension, URLs for those libraries will be
     * included, as well. Temporary directories and/or files will be created as
     * necessary to house bundled libraries. Only .jar files located directly
     * within the root of the main extension .jar are considered.
     *
     * @param extension
     *     The extension .jar file to generate URLs for.
     *
     * @param temporaryFiles
     *     A modifiable List that should be populated with all temporary files
     *     created for the given extension. These files should be deleted on
     *     application shutdown in reverse order.
     *
     * @return
     *     An array of all URLs relevant to the given extension .jar.
     *
     * @throws GuacamoleException
     *     If the given file is not actually a file, the contents of the file
     *     cannot be read, or any necessary temporary files/directories cannot
     *     be created.
     */
    private static URL[] getExtensionURLs(File extension,
            List<File> temporaryFiles) throws GuacamoleException {

        try (JarFile extensionJar = new JarFile(extension)) {

            // Include extension itself within classpath
            List<URL> urls = new ArrayList<>();
            urls.add(getFileURL(extension));

            Path extensionTempLibDir = null;

            // Iterate through all entries (files) within the extension .jar,
            // adding any nested .jar files within the archive root to the
            // classpath
            Enumeration<JarEntry> entries = extensionJar.entries();
            while (entries.hasMoreElements()) {

                JarEntry entry = entries.nextElement();
                String name = entry.getName();

                // Consider only .jar files located in root of archive
                if (entry.isDirectory() ||! name.endsWith(".jar") || name.indexOf('/') != -1)
                    continue;

                // Create temporary directory for housing this extension's
                // bundled .jar files, if not already created
                try {
                    if (extensionTempLibDir == null) {
                        extensionTempLibDir = Files.createTempDirectory(EXTENSION_TEMP_DIR_PREFIX);
                        temporaryFiles.add(extensionTempLibDir.toFile());
                        extensionTempLibDir.toFile().deleteOnExit();
                    }
                }
                catch (IOException e) {
                    throw new GuacamoleServerException("Temporary directory "
                            + "for libraries bundled with extension \""
                            + extension + "\" could not be created.", e);
                }

                // Create temporary file to hold the contents of the current
                // bundled .jar
                File tempLibrary;
                try {
                    tempLibrary = Files.createTempFile(extensionTempLibDir, EXTENSION_TEMP_LIB_PREFIX, ".jar").toFile();
                    temporaryFiles.add(tempLibrary);
                    tempLibrary.deleteOnExit();
                }
                catch (IOException e) {
                    throw new GuacamoleServerException("Temporary file "
                            + "for library \"" + name + "\" bundled with "
                            + "extension \"" + extension + "\" could not be "
                            + "created.", e);
                }

                // Copy contents of bundled .jar to temporary file
                try {
                    copyEntryToFile(extensionJar, entry, tempLibrary);
                }
                catch (IOException e) {
                    throw new GuacamoleServerException("Contents of library "
                            + "\"" + name + "\" bundled with extension \""
                            + extension + "\" could not be copied to a "
                            + "temporary file.", e);
                }

                // Add temporary .jar file to classpath
                urls.add(getFileURL(tempLibrary));

            }

            if (extensionTempLibDir != null)
                logger.debug("Libraries bundled within extension \"{}\" have been "
                        + "copied to temporary directory \"{}\".", extension, extensionTempLibDir);

            return urls.toArray(new URL[0]);

        }
        catch (IOException e) {
            throw new GuacamoleServerException("Contents of extension \""
                    + extension + "\" cannot be read.", e);
        }

    }

    /**
     * Creates a new ExtensionClassLoader configured to load classes from the
     * given extension .jar. If a necessary class cannot be found within the
     * .jar, the given parent ClassLoader is used. Calling this function
     * multiple times will not affect previously-returned instances of
     * ExtensionClassLoader.
     *
     * @param extension
     *     The extension .jar file from which classes should be loaded.
     *
     * @param temporaryFiles
     *     A modifiable List that should be populated with all temporary files
     *     created for the given extension. These files should be deleted on
     *     application shutdown in reverse order.
     *
     * @param parent
     *     The ClassLoader to use if class resolution through the extension
     *     .jar fails.
     *
     * @throws GuacamoleException
     *     If the given file is not actually a file, or the contents of the
     *     file cannot be read.
     */
    public ExtensionClassLoader(File extension, List<File> temporaryFiles,
            ClassLoader parent) throws GuacamoleException {
        super(getExtensionURLs(extension, temporaryFiles), null);
        this.parent = parent;
    }

    @Override
    protected Class<?> findClass(String string) throws ClassNotFoundException {

        // Search only within the given URLs
        try {
            return super.findClass(string);
        }

        // Search parent classloader ONLY if not found within given URLs
        catch (ClassNotFoundException e) {
            return parent.loadClass(string);
        }

    }

}
