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

import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * A GuacamoleProperty whose possible values are defined by an enum. Possible
 * values may be defined either through providing an explicit mapping or
 * through annotating the enum constant definitions with the
 * {@link PropertyValue} annotation.
 *
 * @param <T>
 *     The enum which defines the possible values of this property.
 */
public abstract class EnumGuacamoleProperty<T extends Enum<T>> implements GuacamoleProperty<T> {

    /**
     * Defines the string value which should be accepted and parsed into the
     * annotated enum constant. This annotation is repeatable, and each enum
     * constant may be associated with any any number of string values.
     */
    @Repeatable(PropertyValues.class)
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.FIELD)
    public static @interface PropertyValue {

        /**
         * Returns the String value that should produce the annotated enum
         * constant when parsed.
         *
         * @return
         *     The String value that should produce the annotated enum constant
         *     when parsed.
         */
        String value();

    }

    /**
     * Defines the string values which should be accepted and parsed into the
     * annotated enum constant. Each enum constant may be associated with any
     * any number of string values.
     */
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.FIELD)
    public static @interface PropertyValues {

        /**
         * Returns the {@link PropertyValue} annotations that represent the
         * String values that should produce the annotated enum constant when
         * parsed.
         *
         * @return
         *     The {@link PropertyValue} annotations that represent the String
         *     values that should produce the annotated enum constant when
         *     parsed.
         */
        PropertyValue[] value();

    }

    /**
     * Mapping of valid property values to the corresponding enum constants
     * that those values parse to.
     */
    private final Map<String, T> valueMapping;

    /**
     * Produces a mapping of Guacamole property value to corresponding enum
     * constant. All enum constants annotated with {@link PropertyValue} are
     * included in the resulting Map.
     *
     * @param <T>
     *     The enum for which a value mapping is being produced.
     *
     * @param enumClass
     *     The Class of the enum for which a value mapping is being produced.
     *
     * @return
     *     A new Map which associates the Guacamole property string values of
     *     enum constants (as defined by {@link PropertyValue} annotations)
     *     with their corresponding enum constants.
     */
    private static <T extends Enum<T>> Map<String, T> getValueMapping(Class<T> enumClass) {

        T[] values = enumClass.getEnumConstants();
        Map<String, T> valueMapping = new HashMap<>(values.length);

        for (T value : values) {

            // Retrieve Field which corresponds to the current enum constant
            Field field;
            try {
                field = enumClass.getDeclaredField(value.name());
            }
            catch (NoSuchFieldException e) {
                // This SHOULD be impossible
                throw new IllegalStateException("Fields of enum do not "
                        + "match declared values.", e);
            }

            // Map enum constant only if one or more PropertyValue annotations
            // are present
            PropertyValues valuesAnnotation = field.getAnnotation(PropertyValues.class);
            if (valuesAnnotation != null) {
                for (PropertyValue valueAnnotation : valuesAnnotation.value())
                    valueMapping.put(valueAnnotation.value(), value);
            }

            // The PropertyValue annotation may appear as a separate, single
            // annotation, or as a multi-valued annotation via PropertyValues
            // (see above)
            PropertyValue valueAnnotation = field.getAnnotation(PropertyValue.class);
            if (valueAnnotation != null)
                valueMapping.put(valueAnnotation.value(), value);

        }

        return valueMapping;

    }

    /**
     * Produces a new Map having the given key/value pairs. Each key MUST be a
     * String, and each value MUST be an enum constant belonging to the given
     * enum.
     *
     * @param <T>
     *     The enum whose constants may be used as values within the Map.
     *
     * @param key
     *     The key of the first key/value pair to include within the Map.
     *
     * @param value
     *     The value of the first key/value pair to include within the Map.
     *
     * @param additional
     *     Any additional key/value pairs to be included beyond the first. This
     *     array must be even in length, where each even element is a String
     *     key and each odd element is the enum constant value to be associated
     *     with the key immediately preceding it.
     *
     * @return
     *     A new Map having each of the given key/value pairs.
     *
     * @throws IllegalArgumentException
     *     If any provided key is not a String, if any provided value is not
     *     an enum constant from the given enum type, or if the length of
     *     {@code additional} is not even.
     */
    @SuppressWarnings("unchecked") // We check this ourselves with instanceof and getDeclaringClass()
    private static <T extends Enum<T>> Map<String, T> mapOf(String key, T value,
            Object... additional) throws IllegalArgumentException {

        // Verify length of additional pairs is even
        if (additional.length % 2 != 0)
            throw new IllegalArgumentException("Array of additional key/value pairs must be even in length.");

        // Add first type-checked pair
        Map<String, T> valueMapping = new HashMap<>(1 + additional.length);
        valueMapping.put(key, value);

        Class<T> enumClass = value.getDeclaringClass();

        // Add remaining, unchecked pairs
        for (int i = 0; i < additional.length; i += 2) {

            // Verify that unchecked keys are indeed Strings
            Object additionalKey = additional[i];
            if (!(additionalKey instanceof String))
                throw new IllegalArgumentException("Keys of additional key/value pairs must be strings.");

            // Verify that unchecked values are indeed constants defined by the
            // expected enum
            Object additionalValue = additional[i + 1];
            if (!(additionalValue instanceof Enum) || enumClass != ((Enum) additionalValue).getDeclaringClass())
                throw new IllegalArgumentException("Values of additional key/value pairs must be enum constants of the correct type.");

            valueMapping.put((String) additionalKey, (T) additionalValue);

        }

        return valueMapping;

    }

    /**
     * Creates a new EnumGuacamoleProperty which parses String property values
     * into corresponding enum constants as defined by the given Map.
     *
     * @param valueMapping
     *     A Map which maps all legal String values to their corresponding enum
     *     constants.
     */
    public EnumGuacamoleProperty(Map<String, T> valueMapping) {
        this.valueMapping = valueMapping;
    }

    /**
     * Creates a new EnumGuacamoleProperty which parses String property values
     * into corresponding enum constants as defined by the
     * {@link PropertyValue} annotations associated with those constants.
     *
     * @param enumClass
     *     The enum whose annotated constants should be used as legal values of
     *     this property.
     */
    public EnumGuacamoleProperty(Class<T> enumClass) {
        this(getValueMapping(enumClass));
    }

    /**
     * Creates a new EnumGuacamoleProperty which parses the given String
     * property values into the given corresponding enum constants.
     *
     * @param key
     *     The first String value to accept as a legal value of this property.
     *
     * @param value
     *     The enum constant that {@code key} should be parsed into.
     *
     * @param additional
     *     Any additional key/value pairs to be included beyond the first. This
     *     array must be even in length, where each even element is a String
     *     key and each odd element is the enum constant value to be associated
     *     with the key immediately preceding it.
     *
     * @throws IllegalArgumentException
     *     If any provided key is not a String, if any provided value is not
     *     an enum constant from the given enum type, or if the length of
     *     {@code additional} is not even.
     */
    public EnumGuacamoleProperty(String key, T value, Object... additional)
            throws IllegalArgumentException {
        this(mapOf(key, value, additional));
    }

    @Override
    public T parseValue(String value) throws GuacamoleException {

        // Simply pass through null values
        if (value == null)
            return null;

        // Translate values based on explicit string/constant mapping
        T parsedValue = valueMapping.get(value);
        if (parsedValue != null)
            return parsedValue;

        // Produce human-readable error if no matching constant is found
        List<String> legalValues = new ArrayList<>(valueMapping.keySet());
        Collections.sort(legalValues);

        throw new GuacamoleServerException(String.format("\"%s\" is not a "
                + "valid value for property \"%s\". Valid values are: \"%s\"",
                value, getName(), String.join("\", \"", legalValues)));

    }

}
