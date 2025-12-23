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

package org.apache.guacamole.auth.jdbc.base;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.net.auth.Attributes;
import org.apache.guacamole.net.auth.Identifiable;

/**
 * Common base class for objects that will ultimately be made available through
 * the Directory class and are persisted to an underlying database model. All
 * such objects will need the same base set of queries to fulfill the needs of
 * the Directory class.
 *
 * @param <ModelType>
 *     The type of model object that corresponds to this object.
 */
public abstract class ModeledDirectoryObject<ModelType extends ObjectModel>
    extends ModeledObject<ModelType> implements Identifiable, Attributes {

    @Override
    public String getIdentifier() {
        return getModel().getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        getModel().setIdentifier(identifier);
    }

    /**
     * Returns the names of all attributes explicitly supported by this object.
     * Attributes named here have associated mappings within the backing model
     * object, and thus should not be included in the arbitrary attribute
     * storage. Any attributes set which do not match these names, such as those
     * set via other extensions, will be added to arbitrary attribute storage.
     *
     * @return
     *     A read-only Set of the names of all attributes explicitly supported
     *     (mapped to a property of the backing model) by this object.
     */
    public Set<String> getSupportedAttributeNames() {
        return Collections.<String>emptySet();
    }

    @Override
    public Map<String, String> getAttributes() {
        return new HashMap<String, String>(getModel().getArbitraryAttributeMap());
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {

        ArbitraryAttributeMap arbitraryAttributes = getModel().getArbitraryAttributeMap();

        // Get set of all supported attribute names
        Set<String> supportedAttributes = getSupportedAttributeNames();

        // Store remaining attributes only if not directly mapped to model
        for (Map.Entry<String, String> attribute : attributes.entrySet()) {

            String name = attribute.getKey();
            String value = attribute.getValue();

            // Handle null attributes as explicit removal of that attribute,
            // as the underlying model cannot store null attribute values
            if (!supportedAttributes.contains(name)) {
                if (value == null)
                    arbitraryAttributes.remove(name);
                else
                    arbitraryAttributes.put(name, value);
            }

        }

    }

}
