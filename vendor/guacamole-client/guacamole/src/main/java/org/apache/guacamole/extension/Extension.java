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

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import org.apache.guacamole.net.event.listener.Listener;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.resource.ClassPathResource;
import org.apache.guacamole.resource.Resource;

/**
 * A Guacamole extension, which may provide custom authentication, static
 * files, theming/branding, etc.
 */
public class Extension {

    /**
     * The Jackson parser for parsing the language JSON files.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * The name of the manifest file that describes the contents of a
     * Guacamole extension.
     */
    private static final String MANIFEST_NAME = "guac-manifest.json";

    /**
     * The extension .jar file.
     */
    private final File file;

    /**
     * The parsed manifest file of this extension, describing the location of
     * resources within the extension.
     */
    private final ExtensionManifest manifest;

    /**
     * The classloader to use when reading resources from this extension,
     * including classes and static files.
     */
    private final ClassLoader classLoader;

    /**
     * Map of all JavaScript resources defined within the extension, where each
     * key is the path to that resource within the extension.
     */
    private final Map<String, Resource> javaScriptResources;

    /**
     * Map of all CSS resources defined within the extension, where each key is
     * the path to that resource within the extension.
     */
    private final Map<String, Resource> cssResources;

    /**
     * Map of all HTML patch resources defined within the extension, where each
     * key is the path to that resource within the extension.
     */
    private final Map<String, Resource> htmlResources;

    /**
     * Map of all translation resources defined within the extension, where
     * each key is the path to that resource within the extension.
     */
    private final Map<String, Resource> translationResources;

    /**
     * Map of all resources defined within the extension which are not already
     * associated as JavaScript, CSS, or translation resources, where each key
     * is the path to that resource within the extension.
     */
    private final Map<String, Resource> staticResources;

    /**
     * The collection of all AuthenticationProvider classes defined within the
     * extension.
     */
    private final Collection<Class<AuthenticationProvider>> authenticationProviderClasses;

    /**
     * The collection of all Listener classes defined within the extension.
     */
    private final Collection<Class<?>> listenerClasses;

    /**
     * The resource for the small favicon for the extension. If provided, this
     * will replace the default Guacamole icon.
     */
    private final Resource smallIcon;

    /**
     * The resource foe the large favicon for the extension. If provided, this 
     * will replace the default Guacamole icon.
     */
    private final Resource largeIcon;

    /**
     * Returns a new map of all resources corresponding to the collection of
     * paths provided. Each resource will be associated with the given
     * mimetype, and stored in the map using its path as the key.
     *
     * @param mimetype
     *     The mimetype to associate with each resource.
     *
     * @param paths
     *     The paths corresponding to the resources desired.
     *
     * @return
     *     A new, unmodifiable map of resources corresponding to the
     *     collection of paths provided, where the key of each entry in the
     *     map is the path for the resource stored in that entry.
     */
    private Map<String, Resource> getClassPathResources(String mimetype, Collection<String> paths) {

        // If no paths are provided, just return an empty map 
        if (paths == null)
            return Collections.<String, Resource>emptyMap();

        // Add classpath resource for each path provided
        Map<String, Resource> resources = new LinkedHashMap<>(paths.size());
        for (String path : paths)
            resources.put(path, new ClassPathResource(classLoader, mimetype, path));

        // Callers should not rely on modifying the result
        return Collections.unmodifiableMap(resources);

    }

    /**
     * Returns a new map of all resources corresponding to the map of resource
     * paths provided. Each resource will be associated with the mimetype 
     * stored in the given map using its path as the key.
     *
     * @param resourceTypes 
     *     A map of all paths to their corresponding mimetypes.
     *
     * @return
     *     A new, unmodifiable map of resources corresponding to the
     *     collection of paths provided, where the key of each entry in the
     *     map is the path for the resource stored in that entry.
     */
    private Map<String, Resource> getClassPathResources(Map<String, String> resourceTypes) {

        // If no paths are provided, just return an empty map 
        if (resourceTypes == null)
            return Collections.<String, Resource>emptyMap();

        // Add classpath resource for each path/mimetype pair provided
        Map<String, Resource> resources = new LinkedHashMap<>(resourceTypes.size());
        for (Map.Entry<String, String> resource : resourceTypes.entrySet()) {

            // Get path and mimetype from entry
            String path = resource.getKey();
            String mimetype = resource.getValue();

            // Store as path/resource pair
            resources.put(path, new ClassPathResource(classLoader, mimetype, path));

        }

        // Callers should not rely on modifying the result
        return Collections.unmodifiableMap(resources);

    }

    /**
     * Retrieve the AuthenticationProvider subclass having the given name. If
     * the class having the given name does not exist or isn't actually a
     * subclass of AuthenticationProvider, an exception will be thrown.
     *
     * @param name
     *     The name of the AuthenticationProvider class to retrieve.
     *
     * @return
     *     The subclass of AuthenticationProvider having the given name.
     *
     * @throws GuacamoleException
     *     If no such class exists, or if the class with the given name is not
     *     a subclass of AuthenticationProvider.
     */
    @SuppressWarnings("unchecked") // We check this ourselves with isAssignableFrom()
    private Class<AuthenticationProvider> getAuthenticationProviderClass(String name)
            throws GuacamoleException {

        try {

            // Get authentication provider class
            Class<?> authenticationProviderClass = classLoader.loadClass(name);

            // Verify the located class is actually a subclass of AuthenticationProvider
            if (!AuthenticationProvider.class.isAssignableFrom(authenticationProviderClass))
                throw new GuacamoleServerException("Authentication providers MUST extend the AuthenticationProvider class.");

            // Return located class
            return (Class<AuthenticationProvider>) authenticationProviderClass;

        }
        catch (ClassNotFoundException e) {
            throw new GuacamoleException("Authentication provider class not found.", e);
        }
        catch (LinkageError e) {
            throw new GuacamoleException("Authentication provider class cannot be loaded (wrong version of API?).", e);
        }

    }

    /**
     * Returns a new collection of all AuthenticationProvider subclasses having
     * the given names. If any class does not exist or isn't actually a
     * subclass of AuthenticationProvider, an exception will be thrown, and
     * no further AuthenticationProvider classes will be loaded.
     *
     * @param names
     *     The names of the AuthenticationProvider classes to retrieve.
     *
     * @return
     *     A new collection of all AuthenticationProvider subclasses having the
     *     given names.
     *
     * @throws GuacamoleException
     *     If any given class does not exist, or if any given class is not a
     *     subclass of AuthenticationProvider.
     */
    private Collection<Class<AuthenticationProvider>> getAuthenticationProviderClasses(Collection<String> names)
            throws GuacamoleException {

        // If no classnames are provided, just return an empty list
        if (names == null)
            return Collections.<Class<AuthenticationProvider>>emptyList();

        // Define all auth provider classes
        Collection<Class<AuthenticationProvider>> classes = new ArrayList<Class<AuthenticationProvider>>(names.size());
        for (String name : names)
            classes.add(getAuthenticationProviderClass(name));

        // Callers should not rely on modifying the result
        return Collections.unmodifiableCollection(classes);

    }

    /**
     * Retrieve the Listener subclass having the given name. If
     * the class having the given name does not exist or isn't actually a
     * subclass of Listener, an exception will be thrown.
     *
     * @param name
     *     The name of the Listener class to retrieve.
     *
     * @return
     *     The subclass of Listener having the given name.
     *
     * @throws GuacamoleException
     *     If no such class exists, or if the class with the given name is not
     *     a subclass of Listener.
     */
    @SuppressWarnings("unchecked") // We check this ourselves with isAssignableFrom()
    private Class<Listener> getListenerClass(String name)
            throws GuacamoleException {

        try {

            // Get listener class
            Class<?> listenerClass = classLoader.loadClass(name);

            // Verify the located class is actually a subclass of Listener
            if (!Listener.class.isAssignableFrom(listenerClass))
                throw new GuacamoleServerException("Listeners MUST implement a Listener subclass.");

            // Return located class
            return (Class<Listener>) listenerClass;

        }
        catch (ClassNotFoundException e) {
            throw new GuacamoleException("Listener class not found.", e);
        }
        catch (LinkageError e) {
            throw new GuacamoleException("Listener class cannot be loaded (wrong version of API?).", e);
        }

    }

    /**
     * Returns a new collection of all Listener subclasses having the given names.
     * If any class does not exist or isn't actually subclass of Listener, an
     * exception will be thrown, an no further Listener classes will be loaded.
     *
     * @param names
     *     The names of the AuthenticationProvider classes to retrieve.
     *
     * @return
     *     A new collection of all AuthenticationProvider subclasses having the
     *     given names.
     *
     * @throws GuacamoleException
     *     If any given class does not exist, or if any given class is not a
     *     subclass of AuthenticationProvider.
     */
    private Collection<Class<?>> getListenerClasses(Collection<String> names)
            throws GuacamoleException {

        // If no classnames are provided, just return an empty list
        if (names == null)
            return Collections.<Class<?>>emptyList();

        // Define all auth provider classes
        Collection<Class<?>> classes = new ArrayList<Class<?>>(names.size());
        for (String name : names)
            classes.add(getListenerClass(name));

        // Callers should not rely on modifying the result
        return Collections.unmodifiableCollection(classes);
    }


    /**
     * Loads the given file as an extension, which must be a .jar containing
     * a guac-manifest.json file describing its contents.
     *
     * @param parent
     *     The classloader to use as the parent for the isolated classloader of
     *     this extension.
     *
     * @param file
     *     The file to load as an extension.
     *
     * @param temporaryFiles
     *     A modifiable List that should be populated with all temporary files
     *     created for this extension. These files should be deleted on
     *     application shutdown in reverse order.
     *
     * @throws GuacamoleException
     *     If the provided file is not a .jar file, does not contain the
     *     guac-manifest.json, or if guac-manifest.json is invalid and cannot
     *     be parsed.
     */
    public Extension(final ClassLoader parent, final File file,
            final List<File> temporaryFiles) throws GuacamoleException {

        // Associate extension abstraction with original file
        this.file = file;

        try {

            // Open extension
            ZipFile extension = new ZipFile(file);

            try {

                // Retrieve extension manifest
                ZipEntry manifestEntry = extension.getEntry(MANIFEST_NAME);
                if (manifestEntry == null)
                    throw new GuacamoleServerException("Extension " + file.getName() + " is missing " + MANIFEST_NAME);

                // Parse manifest
                manifest = mapper.readValue(extension.getInputStream(manifestEntry), ExtensionManifest.class);
                if (manifest == null)
                    throw new GuacamoleServerException("Contents of " + MANIFEST_NAME + " must be a valid JSON object.");

            }

            // Always close zip file, if possible
            finally {
                extension.close();
            }

            // Create isolated classloader for this extension
            classLoader = new ExtensionClassLoader(file, temporaryFiles, parent);

        }

        // Abort load if not a valid zip file
        catch (ZipException e) {
            throw new GuacamoleServerException("Extension is not a valid zip file: " + file.getName(), e);
        }

        // Abort if manifest cannot be parsed (invalid JSON)
        catch (JsonParseException e) {
            throw new GuacamoleServerException(MANIFEST_NAME + " is not valid JSON: " + file.getName(), e);
        }

        // Abort if zip file cannot be read at all due to I/O errors
        catch (IOException e) {
            throw new GuacamoleServerException("Unable to read extension: " + file.getName(), e);
        }

        // Define static resources
        cssResources = getClassPathResources("text/css", manifest.getCSSPaths());
        javaScriptResources = getClassPathResources("text/javascript", manifest.getJavaScriptPaths());
        htmlResources = getClassPathResources("text/html", manifest.getHTMLPaths());
        translationResources = getClassPathResources("application/json", manifest.getTranslationPaths());
        staticResources = getClassPathResources(manifest.getResourceTypes());

        // Define authentication providers
        authenticationProviderClasses = getAuthenticationProviderClasses(manifest.getAuthProviders());

        // Define listeners
        listenerClasses = getListenerClasses(manifest.getListeners());

        // Get small icon resource if provided
        if (manifest.getSmallIcon() != null)
            smallIcon = new ClassPathResource(classLoader, "image/png", manifest.getSmallIcon());
        else
            smallIcon = null;

        // Get large icon resource if provided
        if (manifest.getLargeIcon() != null)
            largeIcon = new ClassPathResource(classLoader, "image/png", manifest.getLargeIcon());
        else
            largeIcon = null;
    }

    /**
     * Returns the .jar file containing this Guacamole extension.
     *
     * @return
     *     The extension .jar file.
     */
    public File getFile() {
        return file;
    }

    /**
     * Returns the version of the Guacamole web application for which this
     * extension was built.
     *
     * @return
     *     The version of the Guacamole web application for which this
     *     extension was built.
     */
    public String getGuacamoleVersion() {
        return manifest.getGuacamoleVersion();
    }

    /**
     * Returns the name of this extension, as declared in the extension's
     * manifest.
     *
     * @return
     *     The name of this extension.
     */
    public String getName() {
        return manifest.getName();
    }

    /**
     * Returns the namespace of this extension, as declared in the extension's
     * manifest.
     *
     * @return
     *     The namespace of this extension.
     */
    public String getNamespace() {
        return manifest.getNamespace();
    }

    /**
     * Returns a map of all declared JavaScript resources associated with this
     * extension, where the key of each entry in the map is the path to that
     * resource within the extension .jar. JavaScript resources are declared
     * within the extension manifest.
     *
     * @return
     *     All declared JavaScript resources associated with this extension.
     */
    public Map<String, Resource> getJavaScriptResources() {
        return javaScriptResources;
    }

    /**
     * Returns a map of all declared CSS resources associated with this
     * extension, where the key of each entry in the map is the path to that
     * resource within the extension .jar. CSS resources are declared within
     * the extension manifest.
     *
     * @return
     *     All declared CSS resources associated with this extension.
     */
    public Map<String, Resource> getCSSResources() {
        return cssResources;
    }

    /**
     * Returns a map of all declared HTML patch resources associated with this
     * extension, where the key of each entry in the map is the path to that
     * resource within the extension .jar. HTML patch resources are declared
     * within the extension manifest.
     *
     * @return
     *     All declared HTML patch resources associated with this extension.
     */
    public Map<String, Resource> getHTMLResources() {
        return htmlResources;
    }

    /**
     * Returns a map of all declared translation resources associated with this
     * extension, where the key of each entry in the map is the path to that
     * resource within the extension .jar. Translation resources are declared
     * within the extension manifest.
     *
     * @return
     *     All declared translation resources associated with this extension.
     */
    public Map<String, Resource> getTranslationResources() {
        return translationResources;
    }

    /**
     * Returns a map of all declared resources associated with this extension,
     * where these resources are not already associated as JavaScript, CSS, or
     * translation resources. The key of each entry in the map is the path to
     * that resource within the extension .jar. Static resources are declared
     * within the extension manifest.
     *
     * @return
     *     All declared static resources associated with this extension.
     */
    public Map<String, Resource> getStaticResources() {
        return staticResources;
    }

    /**
     * Returns all declared authentication providers classes associated with
     * this extension. Authentication providers are declared within the
     * extension manifest.
     *
     * @return
     *     All declared authentication provider classes with this extension.
     */
    public Collection<Class<AuthenticationProvider>> getAuthenticationProviderClasses() {
        return authenticationProviderClasses;
    }

    /**
     * Returns all declared listener classes associated wit this extension. Listeners are
     * declared within the extension manifest.
     *
     * @return
     *     All declared listener classes with this extension.
     */
    public Collection<Class<?>> getListenerClasses() {
        return listenerClasses;
    }

    /**
     * Returns the resource for the small favicon for the extension. If
     * provided, this will replace the default Guacamole icon.
     * 
     * @return 
     *     The resource for the small favicon.
     */
    public Resource getSmallIcon() {
        return smallIcon;
    }

    /**
     * Returns the resource for the large favicon for the extension. If
     * provided, this will replace the default Guacamole icon.
     * 
     * @return 
     *     The resource for the large favicon.
     */
    public Resource getLargeIcon() {
        return largeIcon;
    }

}
