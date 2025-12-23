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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.servlet.ServletContext;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.StringSetProperty;
import org.apache.guacamole.resource.ByteArrayResource;
import org.apache.guacamole.resource.Resource;
import org.apache.guacamole.resource.WebApplicationResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service which provides access to all built-in languages as resources, and
 * allows other resources to be added or overlaid against existing resources.
 */
public class LanguageResourceService {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(LanguageResourceService.class);
    
    /**
     * The path to the translation folder within the webapp.
     */
    private static final String TRANSLATION_PATH = "/translations";
    
    /**
     * The JSON property for the human readable display name.
     */
    private static final String LANGUAGE_DISPLAY_NAME_KEY = "NAME";
    
    /**
     * The Jackson parser for parsing the language JSON files.
     */
    private static final ObjectMapper mapper = new ObjectMapper();
    
    /**
     * The regular expression to use for parsing the language key from the
     * filename.
     */
    private static final Pattern LANGUAGE_KEY_PATTERN = Pattern.compile(".*/([a-z]+(_[A-Z]+)?)\\.json");

    /**
     * Comma-separated list of all allowed languages, where each language is
     * represented by a language key, such as "en" or "en_US". If specified,
     * only languages within this list will be listed as available by the REST
     * service.
     */
    public final StringSetProperty ALLOWED_LANGUAGES = new StringSetProperty() {

        @Override
        public String getName() { return "allowed-languages"; }

    };

    /**
     * The set of all language keys which are explicitly listed as allowed
     * within guacamole.properties, or null if all defined languages should be
     * allowed.
     */
    private final Set<String> allowedLanguages;

    /**
     * Map of all language resources by language key. Language keys are
     * language and country code pairs, separated by an underscore, like
     * "en_US". The country code and underscore SHOULD be omitted in the case
     * that only one dialect of that language is defined, or in the case of the
     * most universal or well-supported of all supported dialects of that
     * language.
     */
    private final Map<String, Resource> resources = new HashMap<String, Resource>();

    /**
     * Creates a new service for tracking and parsing available translations
     * which reads its configuration from the given environment.
     *
     * @param environment
     *     The environment from which the configuration properties of this
     *     service should be read.
     */
    public LanguageResourceService(Environment environment) {

        Set<String> parsedAllowedLanguages;

        // Parse list of available languages from properties
        try {
            parsedAllowedLanguages = environment.getProperty(ALLOWED_LANGUAGES);
            logger.debug("Available languages will be restricted to: {}", parsedAllowedLanguages);
        }

        // Warn of failure to parse
        catch (GuacamoleException e) {
            parsedAllowedLanguages = null;
            logger.error("Unable to parse list of allowed languages: {}", e.getMessage());
            logger.debug("Error parsing list of allowed languages.", e);
        }

        this.allowedLanguages = parsedAllowedLanguages;

    }

    /**
     * Derives a language key from the filename within the given path, if
     * possible. If the filename is not a valid language key, null is returned.
     *
     * @param path
     *     The path containing the filename to derive the language key from.
     *
     * @return
     *     The derived language key, or null if the filename is not a valid
     *     language key.
     */
    public String getLanguageKey(String path) {

        // Parse language key from filename
        Matcher languageKeyMatcher = LANGUAGE_KEY_PATTERN.matcher(path);
        if (!languageKeyMatcher.matches())
            return null;

        // Return parsed key
        return languageKeyMatcher.group(1);

    }

    /**
     * Merges the given JSON objects. Any leaf node in overlay will overwrite
     * the corresponding path in original.
     *
     * @param original
     *     The original JSON object to which changes should be applied.
     *
     * @param overlay
     *     The JSON object containing changes that should be applied.
     *
     * @return
     *     The newly constructed JSON object that is the result of merging
     *     original and overlay.
     */
    private JsonNode mergeTranslations(JsonNode original, JsonNode overlay) {

        // If we are at a leaf node, the result of merging is simply the overlay
        if (!overlay.isObject() || original == null)
            return overlay;

        // Create mutable copy of original
        ObjectNode newNode = JsonNodeFactory.instance.objectNode();
        Iterator<String> fieldNames = original.fieldNames();
        while (fieldNames.hasNext()) {
            String fieldName = fieldNames.next();
            newNode.set(fieldName, original.get(fieldName));
        }

        // Merge each field
        fieldNames = overlay.fieldNames();
        while (fieldNames.hasNext()) {
            String fieldName = fieldNames.next();
            newNode.set(fieldName, mergeTranslations(original.get(fieldName), overlay.get(fieldName)));
        }

        return newNode;

    }

    /**
     * Parses the given language resource, returning the resulting JsonNode.
     * If the resource cannot be read because it does not exist, null is
     * returned.
     *
     * @param resource
     *     The language resource to parse. Language resources must have the
     *     mimetype "application/json".
     *
     * @return
     *     A JsonNode representing the root of the parsed JSON tree, or null if
     *     the given resource does not exist.
     *
     * @throws IOException
     *     If an error occurs while parsing the resource as JSON.
     */
    private JsonNode parseLanguageResource(Resource resource) throws IOException {

        // Get resource stream
        InputStream stream = resource.asStream();
        if (stream == null)
            return null;

        // Parse JSON tree
        try {
            JsonNode tree = mapper.readTree(stream);
            return tree;
        }

        // Ensure stream is always closed
        finally {
            stream.close();
        }

    }

    /**
     * Returns whether a language having the given key should be allowed to be
     * loaded. If language availability restrictions are imposed through
     * guacamole.properties, this may return false in some cases. By default,
     * this function will always return true. Note that just because a language
     * key is allowed to be loaded does not imply that the language key is
     * valid.
     *
     * @param languageKey
     *     The language key of the language to test.
     *
     * @return
     *     true if the given language key should be allowed to be loaded, false
     *     otherwise.
     */
    private boolean isLanguageAllowed(String languageKey) {

        // If no list is provided, all languages are implicitly available
        if (allowedLanguages == null)
            return true;

        return allowedLanguages.contains(languageKey);

    }

    /**
     * Adds or overlays the given language resource, which need not exist in
     * the ServletContext. If a language resource is already defined for the
     * given language key, the strings from the given resource will be overlaid
     * on top of the existing strings, augmenting or overriding the available
     * strings for that language.
     *
     * @param key
     *     The language key of the resource being added. Language keys are
     *     pairs consisting of a language code followed by an underscore and
     *     country code, such as "en_US".
     *
     * @param resource
     *     The language resource to add. This resource must have the mimetype
     *     "application/json".
     */
    public void addLanguageResource(String key, Resource resource) {

        // Skip loading of language if not allowed
        if (!isLanguageAllowed(key)) {
            logger.debug("OMITTING language: \"{}\"", key);
            return;
        }

        // Merge language resources if already defined
        Resource existing = resources.get(key);
        if (existing != null) {

            try {

                // Read the original language resource
                JsonNode existingTree = parseLanguageResource(existing);
                if (existingTree == null) {
                    logger.warn("Base language resource \"{}\" does not exist.", key);
                    return;
                }

                // Read new language resource
                JsonNode resourceTree = parseLanguageResource(resource);
                if (resourceTree == null) {
                    logger.warn("Overlay language resource \"{}\" does not exist.", key);
                    return;
                }

                // Merge the language resources
                JsonNode mergedTree = mergeTranslations(existingTree, resourceTree);
                resources.put(key, new ByteArrayResource("application/json", mapper.writeValueAsBytes(mergedTree)));

                logger.debug("Merged strings with existing language: \"{}\"", key);

            }
            catch (IOException e) {
                logger.error("Unable to merge language resource \"{}\": {}", key, e.getMessage());
                logger.debug("Error merging language resource.", e);
            }

        }

        // Otherwise, add new language resource
        else {
            resources.put(key, resource);
            logger.debug("Added language: \"{}\"", key);
        }

    }

    /**
     * Adds or overlays all languages defined within the /translations
     * directory of the given ServletContext. If no such language files exist,
     * nothing is done. If a language is already defined, the strings from the
     * will be overlaid on top of the existing strings, augmenting or
     * overriding the available strings for that language. The language key
     * for each language file is derived from the filename.
     *
     * @param context
     *     The ServletContext from which language files should be loaded.
     */
    public void addLanguageResources(ServletContext context) {

        // Get the paths of all the translation files
        Set<?> resourcePaths = context.getResourcePaths(TRANSLATION_PATH);
        
        // If no translation files found, nothing to add
        if (resourcePaths == null)
            return;
        
        // Iterate through all the found language files and add them to the map
        for (Object resourcePathObject : resourcePaths) {

            // Each resource path is guaranteed to be a string
            String resourcePath = (String) resourcePathObject;

            // Parse language key from path
            String languageKey = getLanguageKey(resourcePath);
            if (languageKey == null) {
                logger.warn("Invalid language file name: \"{}\"", resourcePath);
                continue;
            }

            // Add/overlay new resource
            addLanguageResource(
                languageKey,
                new WebApplicationResource(context, "application/json", resourcePath)
            );

        }

    }

    /**
     * Returns a set of all unique language keys currently associated with
     * language resources stored in this service. The returned set cannot be
     * modified.
     *
     * @return
     *     A set of all unique language keys currently associated with this
     *     service.
     */
    public Set<String> getLanguageKeys() {
        return Collections.unmodifiableSet(resources.keySet());
    }

    /**
     * Returns a map of all languages currently associated with this service,
     * where the key of each map entry is the language key. The returned map
     * cannot be modified.
     *
     * @return
     *     A map of all languages currently associated with this service.
     */
    public Map<String, Resource> getLanguageResources() {
        return Collections.unmodifiableMap(resources);
    }

    /**
     * Returns a mapping of all language keys to their corresponding human-
     * readable language names. If an error occurs while parsing a language
     * resource, its key/name pair will simply be omitted. The returned map
     * cannot be modified.
     *
     * @return
     *     A map of all language keys and their corresponding human-readable
     *     names.
     */
    public Map<String, String> getLanguageNames() {

        Map<String, String> languageNames = new HashMap<String, String>();

        // For each language key/resource pair
        for (Map.Entry<String, Resource> entry : resources.entrySet()) {

            // Get language key and resource
            String languageKey = entry.getKey();
            Resource resource = entry.getValue();

            // Get stream for resource
            InputStream resourceStream = resource.asStream();
            if (resourceStream == null) {
                logger.warn("Expected language resource does not exist: \"{}\".", languageKey);
                continue;
            }
            
            // Get name node of language
            try {
                JsonNode tree = mapper.readTree(resourceStream);
                JsonNode nameNode = tree.get(LANGUAGE_DISPLAY_NAME_KEY);
                
                // Attempt to read language name from node
                String languageName;
                if (nameNode == null || (languageName = nameNode.textValue()) == null) {
                    logger.warn("Root-level \"" + LANGUAGE_DISPLAY_NAME_KEY + "\" string missing or invalid in language \"{}\"", languageKey);
                    languageName = languageKey;
                }
                
                // Add language key/name pair to map
                languageNames.put(languageKey, languageName);

            }

            // Continue with next language if unable to read
            catch (IOException e) {
                logger.warn("Unable to read language resource \"{}\".", languageKey);
                logger.debug("Error reading language resource.", e);
            }

        }
        
        return Collections.unmodifiableMap(languageNames);
        
    }
    
}
