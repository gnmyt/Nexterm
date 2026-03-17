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

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collection;
import java.util.Map;

/**
 * Java representation of the JSON manifest contained within every Guacamole
 * extension, identifying an extension and describing its contents.
 */
public class ExtensionManifest {

    /**
     * The version of Guacamole for which this extension was built.
     * Compatibility rules built into the web application will guard against
     * incompatible extensions being loaded.
     */
    private String guacamoleVersion;

    /**
     * The name of the extension associated with this manifest. The extension
     * name is human-readable, and used for display purposes only.
     */
    private String name;

    /**
     * The namespace of the extension associated with this manifest. The
     * extension namespace is required for internal use, and is used wherever
     * extension-specific files or resources need to be isolated from those of
     * other extensions.
     */
    private String namespace;

    /**
     * The paths of all JavaScript resources within the .jar of the extension
     * associated with this manifest.
     */
    private Collection<String> javaScriptPaths;

    /**
     * The paths of all CSS resources within the .jar of the extension
     * associated with this manifest.
     */
    private Collection<String> cssPaths;

    /**
     * The paths of all HTML patch resources within the .jar of the extension
     * associated with this manifest.
     */
    private Collection<String> htmlPaths;

    /**
     * The paths of all translation JSON files within this extension, if any.
     */
    private Collection<String> translationPaths;

    /**
     * The mimetypes of all resources within this extension which are not
     * already declared as JavaScript, CSS, or translation resources, if any.
     * The key of each entry is the resource path, while the value is the
     * corresponding mimetype.
     */
    private Map<String, String> resourceTypes;

    /**
     * The names of all authentication provider classes within this extension,
     * if any.
     */
    private Collection<String> authProviders;

    /**
     * The names of all listener classes within this extension, if any.
     */
    private Collection<String> listeners;

    /**
     * The path to the small favicon. If provided, this will replace the default
     * Guacamole icon.
     */
    private String smallIcon;

    /**
     * The path to the large favicon. If provided, this will replace the default
     * Guacamole icon.
     */
    private String largeIcon;

    /**
     * Returns the version of the Guacamole web application for which the
     * extension was built, such as "0.9.7".
     *
     * @return
     *     The version of the Guacamole web application for which the extension
     *     was built.
     */
    public String getGuacamoleVersion() {
        return guacamoleVersion;
    }

    /**
     * Sets the version of the Guacamole web application for which the
     * extension was built, such as "0.9.7".
     *
     * @param guacamoleVersion
     *     The version of the Guacamole web application for which the extension
     *     was built.
     */
    public void setGuacamoleVersion(String guacamoleVersion) {
        this.guacamoleVersion = guacamoleVersion;
    }

    /**
     * Returns the name of the extension associated with this manifest. The
     * name is human-readable, for display purposes only, and is defined within
     * the manifest by the "name" property.
     *
     * @return
     *     The name of the extension associated with this manifest.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of the extension associated with this manifest. The name
     * is human-readable, for display purposes only, and is defined within the
     * manifest by the "name" property.
     *
     * @param name
     *     The name of the extension associated with this manifest.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the namespace of the extension associated with this manifest.
     * The namespace is required for internal use, and is used wherever
     * extension-specific files or resources need to be isolated from those of
     * other extensions. It is defined within the manifest by the "namespace"
     * property.
     *
     * @return
     *     The namespace of the extension associated with this manifest.
     */
    public String getNamespace() {
        return namespace;
    }

    /**
     * Sets the namespace of the extension associated with this manifest. The
     * namespace is required for internal use, and is used wherever extension-
     * specific files or resources need to be isolated from those of other
     * extensions. It is defined within the manifest by the "namespace"
     * property.
     *
     * @param namespace
     *     The namespace of the extension associated with this manifest.
     */
    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    /**
     * Returns the paths to all JavaScript resources within the extension.
     * These paths are defined within the manifest by the "js" property as an
     * array of strings, where each string is a path relative to the root of
     * the extension .jar.
     *
     * @return
     *     A collection of paths to all JavaScript resources within the
     *     extension.
     */
    @JsonProperty("js")
    public Collection<String> getJavaScriptPaths() {
        return javaScriptPaths;
    }

    /**
     * Sets the paths to all JavaScript resources within the extension. These
     * paths are defined within the manifest by the "js" property as an array
     * of strings, where each string is a path relative to the root of the
     * extension .jar.
     *
     * @param javaScriptPaths
     *     A collection of paths to all JavaScript resources within the
     *     extension.
     */
    @JsonProperty("js")
    public void setJavaScriptPaths(Collection<String> javaScriptPaths) {
        this.javaScriptPaths = javaScriptPaths;
    }

    /**
     * Returns the paths to all CSS resources within the extension. These paths
     * are defined within the manifest by the "js" property as an array of
     * strings, where each string is a path relative to the root of the
     * extension .jar.
     *
     * @return
     *     A collection of paths to all CSS resources within the extension.
     */
    @JsonProperty("css")
    public Collection<String> getCSSPaths() {
        return cssPaths;
    }

    /**
     * Sets the paths to all CSS resources within the extension. These paths
     * are defined within the manifest by the "js" property as an array of
     * strings, where each string is a path relative to the root of the
     * extension .jar.
     *
     * @param cssPaths
     *     A collection of paths to all CSS resources within the extension.
     */
    @JsonProperty("css")
    public void setCSSPaths(Collection<String> cssPaths) {
        this.cssPaths = cssPaths;
    }

    /**
     * Returns the paths to all HTML patch resources within the extension. These
     * paths are defined within the manifest by the "html" property as an array
     * of strings, where each string is a path relative to the root of the
     * extension .jar.
     *
     * @return
     *     A collection of paths to all HTML patch resources within the
     *     extension.
     */
    @JsonProperty("html")
    public Collection<String> getHTMLPaths() {
        return htmlPaths;
    }

    /**
     * Sets the paths to all HTML patch resources within the extension. These
     * paths are defined within the manifest by the "html" property as an array
     * of strings, where each string is a path relative to the root of the
     * extension .jar.
     *
     * @param htmlPatchPaths
     *     A collection of paths to all HTML patch resources within the
     *     extension.
     */
    @JsonProperty("html")
    public void setHTMLPaths(Collection<String> htmlPatchPaths) {
        this.htmlPaths = htmlPatchPaths;
    }

    /**
     * Returns the paths to all translation resources within the extension.
     * These paths are defined within the manifest by the "translations"
     * property as an array of strings, where each string is a path relative to
     * the root of the extension .jar.
     *
     * @return
     *     A collection of paths to all translation resources within the
     *     extension.
     */
    @JsonProperty("translations")
    public Collection<String> getTranslationPaths() {
        return translationPaths;
    }

    /**
     * Sets the paths to all translation resources within the extension. These
     * paths are defined within the manifest by the "translations" property as
     * an array of strings, where each string is a path relative to the root of
     * the extension .jar.
     *
     * @param translationPaths
     *     A collection of paths to all translation resources within the
     *     extension.
     */
    @JsonProperty("translations")
    public void setTranslationPaths(Collection<String> translationPaths) {
        this.translationPaths = translationPaths;
    }

    /**
     * Returns a map of all resources to their corresponding mimetypes, for all
     * resources not already declared as JavaScript, CSS, or translation
     * resources. These paths and corresponding types are defined within the
     * manifest by the "resources" property as an object, where each property
     * name is a path relative to the root of the extension .jar, and each
     * value is a mimetype.
     *
     * @return
     *     A map of all resources within the extension to their corresponding
     *     mimetypes.
     */
    @JsonProperty("resources")
    public Map<String, String> getResourceTypes() {
        return resourceTypes;
    }

    /**
     * Sets the map of all resources to their corresponding mimetypes, for all
     * resources not already declared as JavaScript, CSS, or translation
     * resources. These paths and corresponding types are defined within the
     * manifest by the "resources" property as an object, where each property
     * name is a path relative to the root of the extension .jar, and each
     * value is a mimetype.
     *
     * @param resourceTypes
     *     A map of all resources within the extension to their corresponding
     *     mimetypes.
     */
    @JsonProperty("resources")
    public void setResourceTypes(Map<String, String> resourceTypes) {
        this.resourceTypes = resourceTypes;
    }

    /**
     * Returns the classnames of all authentication provider classes within the
     * extension. These classnames are defined within the manifest by the
     * "authProviders" property as an array of strings, where each string is an
     * authentication provider classname.
     *
     * @return
     *     A collection of classnames of all authentication providers within
     *     the extension.
     */
    public Collection<String> getAuthProviders() {
        return authProviders;
    }

    /**
     * Sets the classnames of all authentication provider classes within the
     * extension. These classnames are defined within the manifest by the
     * "authProviders" property as an array of strings, where each string is an
     * authentication provider classname.
     *
     * @param authProviders
     *     A collection of classnames of all authentication providers within
     *     the extension.
     */
    public void setAuthProviders(Collection<String> authProviders) {
        this.authProviders = authProviders;
    }

    /**
     * Returns the classnames of all listener classes within the extension.
     * These classnames are defined within the manifest by the "listeners"
     * property as an array of strings, where each string is a listener
     * class name.
     *
     * @return
     *      A collection of classnames for all listeners within the extension.
     */
    public Collection<String> getListeners() {
        return listeners;
    }

    /**
     * Sets the classnames of all listener classes within the extension.
     * These classnames are defined within the manifest by the "listeners"
     * property as an array of strings, where each string is a listener
     * class name.
     *
     * @param listeners
     *      A collection of classnames for all listeners within the extension.
     */
    public void setListeners(Collection<String> listeners) {
        this.listeners = listeners;
    }

    /**
     * Returns the path to the small favicon, relative to the root of the
     * extension.
     *
     * @return 
     *     The path to the small favicon.
     */
    public String getSmallIcon() {
        return smallIcon;
    }

    /**
     * Sets the path to the small favicon. This will replace the default
     * Guacamole icon.
     *
     * @param smallIcon 
     *     The path to the small favicon.
     */
    public void setSmallIcon(String smallIcon) {
        this.smallIcon = smallIcon;
    }

    /**
     * Returns the path to the large favicon, relative to the root of the
     * extension.
     *
     * @return
     *     The path to the large favicon.
     */
    public String getLargeIcon() {
        return largeIcon;
    }

    /**
     * Sets the path to the large favicon. This will replace the default
     * Guacamole icon.
     *
     * @param largeIcon
     *     The path to the large favicon.
     */
    public void setLargeIcon(String largeIcon) {
        this.largeIcon = largeIcon;
    }

}
