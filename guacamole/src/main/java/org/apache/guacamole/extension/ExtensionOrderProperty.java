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

import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.properties.GuacamoleProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A GuacamoleProperty that defines the order of Guacamole extensions. The
 * property value is a comma-separated list of extension namespaces, with "*"
 * used to represent all extensions that aren't listed. For example, a value
 * like "saml, *, ldap" would order SAML support first and LDAP support last,
 * with all other extensions loaded between the two in filename order. For
 * values without "*", all other extensions are implicitly after all extensions
 * that are explicitly listed.
 */
public abstract class ExtensionOrderProperty implements GuacamoleProperty<Comparator<Extension>> {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ExtensionOrderProperty.class);

    /**
     * A pattern which matches against the delimiters between values. This is
     * currently simply a comma and any following whitespace. Parts of the
     * input string which match this pattern will not be included in the parsed
     * result.
     */
    private static final Pattern DELIMITER_PATTERN = Pattern.compile(",\\s*");

    /**
     * Static comparator instance that sorts extensions by their filenames
     * alone.
     */
    public static final Comparator<Extension> DEFAULT_COMPARATOR = new ExtensionComparator();

    /**
     * Comparator that sorts extensions in order of priority, as dictated by a
     * list of the extensions that should be ordered first or last. All
     * extensions not explicitly listed will instead be sorted by filename.
     */
    private static class ExtensionComparator implements Comparator<Extension> {

        /**
         * The string value representing the set of all extensions not
         * explicitly listed.
         */
        private final String OTHER_EXTENSIONS = "*";

        /**
         * The relative priorities of all extensions. Any extension not listed
         * within this map should be sorted with the priority value stored in
         * {@link #defaultPriority}.
         */
        private final Map<String, Integer> extensionPriority;

        /**
         * The relative priority that should be used for all extensions not
         * explicitly listed within {@link #extensionPriority}.
         */
        private final int defaultPriority;

        /**
         * Creates a new ExtensionComparator that sorts all extensions by their
         * filenames only.
         */
        public ExtensionComparator() {
            defaultPriority = 0;
            extensionPriority = Collections.emptyMap();
        }

        /**
         * Creates a new ExtensionComparator that ensures each of the given
         * extensions are sorted in the relative order listed, with any
         * extensions not explicitly listed sorted by filename.
         *
         * @param name
         *     The name of the property defining the provided list of
         *     extensions.
         *
         * @param extensions
         *     The namespaces of the extensions in the order they should be
         *     sorted, with the special value "*" functioning as a
         *     placeholder for all extensions that are not explicitly listed.
         */
        public ExtensionComparator(String name, String... extensions) {

            extensionPriority = new HashMap<>(extensions.length);

            for (int priority = 0; priority < extensions.length; priority++) {
                String extension = extensions[priority];
                if (extensionPriority.putIfAbsent(extension, priority) != null)
                    logger.warn("The value \"{}\" was specified multiple "
                            + "times for property \"{}\". Only the first "
                            + "occurrence of this value will have any effect.",
                            extension, name);
            }

            Integer otherExtensionPriority = extensionPriority.remove(OTHER_EXTENSIONS);
            if (otherExtensionPriority != null)
                defaultPriority = otherExtensionPriority;
            else
                defaultPriority = extensions.length;

        }

        @Override
        public int compare(Extension extA, Extension extB) {

            int priorityA = extensionPriority.getOrDefault(extA.getNamespace(), defaultPriority);
            int priorityB = extensionPriority.getOrDefault(extB.getNamespace(), defaultPriority);

            // Sort by explicit priority first
            if (priorityA != priorityB)
                return priorityA - priorityB;

            // Sort all extensions without explicit priorities by their
            // filenames (no extensions will have the same priority except
            // those that aren't explicitly listed)
            return extA.getFile().compareTo(extB.getFile());

        }

    }

    @Override
    public Comparator<Extension> parseValue(String value) throws GuacamoleException {

        // If no property provided, return null.
        if (value == null)
            return null;

        // Split string into a set of individual values
        return new ExtensionComparator(getName(), DELIMITER_PATTERN.split(value));

    }

}
