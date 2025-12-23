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

import java.util.AbstractCollection;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Map of arbitrary attribute name/value pairs which can alternatively be
 * exposed as a collection of model objects.
 */
public class ArbitraryAttributeMap extends HashMap<String, String> {

    /**
     * Creates a new ArbitraryAttributeMap containing the name/value pairs
     * within the given collection of model objects.
     *
     * @param models
     *     The model objects of all attributes which should be stored in the
     *     new map as name/value pairs.
     *
     * @return
     *     A new ArbitraryAttributeMap containing the name/value pairs within
     *     the given collection of model objects.
     */
    public static ArbitraryAttributeMap fromModelCollection(Collection<ArbitraryAttributeModel> models) {

        // Add all name/value pairs from the given collection to the map
        ArbitraryAttributeMap map = new ArbitraryAttributeMap();
        for (ArbitraryAttributeModel model : models)
            map.put(model.getName(), model.getValue());

        return map;

    }

    /**
     * Returns a collection of model objects which mirrors the contents of this
     * ArbitraryAttributeMap. Each name/value pair within the map is reflected
     * by a corresponding model object within the returned collection. Removing
     * a model object from the collection removes the corresponding name/value
     * pair from the map. Adding a new model object to the collection adds a
     * corresponding name/value pair to the map. Changes to a model object
     * within the collection are NOT reflected on the map, however.
     *
     * @return
     *     A collection of model objects which mirrors the contents of this
     *     ArbitraryAttributeMap.
     */
    public Collection<ArbitraryAttributeModel> toModelCollection() {
        return new AbstractCollection<ArbitraryAttributeModel>() {

            @Override
            public void clear() {
                ArbitraryAttributeMap.this.clear();
            }

            @Override
            public boolean remove(Object o) {

                // The Collection view of an ArbitraryAttributeMap can contain
                // only ArbitraryAttributeModel objects
                if (!(o instanceof ArbitraryAttributeModel))
                    return false;

                // Remove only if key is actually present
                ArbitraryAttributeModel model = (ArbitraryAttributeModel) o;
                if (!ArbitraryAttributeMap.this.containsKey(model.getName()))
                    return false;

                // The attribute should be removed only if the value matches
                String currentValue = ArbitraryAttributeMap.this.get(model.getName());
                if (currentValue == null) {
                    if (model.getValue() != null)
                        return false;
                }
                else if (!currentValue.equals(model.getValue()))
                    return false;

                ArbitraryAttributeMap.this.remove(model.getName());
                return true;

            }

            @Override
            public boolean add(ArbitraryAttributeModel e) {

                String newValue = e.getValue();
                String oldValue = put(e.getName(), newValue);

                // If null value is being added, collection changed only if
                // old value was non-null
                if (newValue == null)
                    return oldValue != null;

                // Collection changed if value changed
                return !newValue.equals(oldValue);

            }

            @Override
            public boolean contains(Object o) {

                // The Collection view of an ArbitraryAttributeMap can contain
                // only ArbitraryAttributeModel objects
                if (!(o instanceof ArbitraryAttributeModel))
                    return false;

                // No need to check the value of the attribute if the attribute
                // is not even present
                ArbitraryAttributeModel model = (ArbitraryAttributeModel) o;
                String value = get(model.getName());
                if (value == null)
                    return false;

                // The name/value pair is present only if the value matches
                return value.equals(model.getValue());

            }

            @Override
            public Iterator<ArbitraryAttributeModel> iterator() {

                // Get iterator over all string name/value entries
                final Iterator<Map.Entry<String, String>> iterator = entrySet().iterator();

                // Dynamically translate each string name/value entry into a
                // corresponding attribute model object as iteration continues
                return new Iterator<ArbitraryAttributeModel>() {

                    @Override
                    public boolean hasNext() {
                        return iterator.hasNext();
                    }

                    @Override
                    public ArbitraryAttributeModel next() {
                        Map.Entry<String, String> entry = iterator.next();
                        return new ArbitraryAttributeModel(entry.getKey(),
                                entry.getValue());
                    }

                    @Override
                    public void remove() {
                        iterator.remove();
                    }

                };

            }

            @Override
            public int size() {
                return ArbitraryAttributeMap.this.size();
            }

        };
    }

}
