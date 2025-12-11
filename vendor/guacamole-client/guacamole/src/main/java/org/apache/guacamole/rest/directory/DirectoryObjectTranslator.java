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

package org.apache.guacamole.rest.directory;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.UserContext;

/**
 * Provides bidirectional conversion between REST-specific objects and the
 * internal objects defined by the Guacamole extension API.
 *
 * @param <InternalType>
 *     The type of object converted by this DirectoryObjectTranslator which is
 *     not necessarily intended for use in interchange.
 *
 * @param <ExternalType>
 *     The type of object used in interchange (ie: serialized or
 *     deserialized as JSON) between REST clients and resource implementations
 *     when representing the InternalType.
 */
public abstract class DirectoryObjectTranslator<InternalType extends Identifiable, ExternalType> {

    /**
     * Converts the given object to an object which is intended to be used in
     * interchange.
     *
     * @param object
     *     The object to convert for the sake of interchange.
     *
     * @return
     *     A new object containing the same data as the given internal object,
     *     but intended for use in interchange.
     *
     * @throws GuacamoleException
     *     If the provided object cannot be converted for any reason.
     */
    public abstract ExternalType toExternalObject(InternalType object)
            throws GuacamoleException;

    /**
     * Converts the given object to an object which is intended to be used
     * within the Guacamole extension API.
     *
     * @param object
     *     An object of the type intended for use in interchange, such as that
     *     produced by toExternalObject() or received from a user via REST.
     *
     * @return
     *     A new object containing the same data as the given external object,
     *     but intended for use within the Guacamole extension API.
     *
     * @throws GuacamoleException
     *     If the provided object cannot be converted for any reason.
     */
    public abstract InternalType toInternalObject(ExternalType object)
            throws GuacamoleException;

    /**
     * Overlays the changes indicated by the given external object, modifying
     * the given existing object from the Guacamole extension API.
     *
     * @param existingObject
     *     The existing object from the Guacamole extension API which should be
     *     modified.
     *
     * @param object
     *     The external object representing the modifications to the existing
     *     internal object.
     *
     * @throws GuacamoleException
     *     If the provided modifications cannot be applied for any reason.
     */
    public abstract void applyExternalChanges(InternalType existingObject,
            ExternalType object) throws GuacamoleException;

    /**
     * Applies filtering to the contents of the given external object which
     * came from an untrusted source. Implementations MUST sanitize the
     * contents of the external object as necessary to guarantee that the
     * object conforms to declared schema, such as the attributes declared for
     * each object type at the UserContext level.
     *
     * @param userContext
     *     The UserContext associated with the object being filtered.
     *
     * @param object
     *     The object to modify such that it strictly conforms to the declared
     *     schema.
     *
     * @throws GuacamoleException
     *     If the object cannot be filtered due to an error.
     */
    public abstract void filterExternalObject(UserContext userContext,
            ExternalType object) throws GuacamoleException;

    /**
     * Filters the given map of attribute name/value pairs, producing a new
     * map containing only attributes defined as fields within the given schema.
     *
     * @param schema
     *     The schema whose fields should be used to filter the given map of
     *     attributes.
     *
     * @param attributes
     *     The map of attribute name/value pairs to filter.
     *
     * @return
     *     A new map containing only the attributes defined as fields within
     *     the given schema.
     */
    public Map<String, String> filterAttributes(Collection<Form> schema,
            Map<String, String> attributes) {

        Map<String, String> filtered = new HashMap<String, String>();

        // Grab all attribute value strictly for defined fields
        for (Form form : schema) {
            for (Field field : form.getFields()) {

                // Pull the associated attribute value from given map
                String attributeName = field.getName();
                String attributeValue = attributes.get(attributeName);

                // Include attribute value within filtered map only if
                // defined or present within provided map
                if (attributeValue != null || 
                        attributes.containsKey(attributeName))
                    filtered.put(attributeName, attributeValue);

            }
        }

        return filtered;

    }

}
