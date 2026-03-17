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

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Test which verifies that EnumGuacamoleProperty functions correctly.
 */
public class EnumGuacamolePropertyTest {

    /**
     * Example enum consisting of a small set of possible fish. All values of
     * this enum are annotated with {@link PropertyValue}.
     */
    public static enum Fish {

        /**
         * Salmon are large, anadromous fish prized for their pink/red/orange
         * flesh.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Salmon">Salmon (Wikipedia)</a>
         */
        @PropertyValue("salmon")
        SALMON,

        /**
         * Trout are freshwater fish related to salmon, popular both as food
         * and as game fish.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Trout">Trout (Wikipedia)</a>
         */
        @PropertyValue("trout")
        TROUT,

        /**
         * Mackerel are pelagic fish, typically having vertical stripes along
         * their backs.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Mackerel">Mackerel (Wikipedia)</a>
         */
        @PropertyValue("mackerel")
        MACKEREL,

        /**
         * Tuna are large, predatory, saltwater fish in the same family as
         * mackerel. They are one of the few fish that can maintain a body
         * temperature higher than the surrounding water.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Tuna">Tuna (Wikipedia)</a>
         */
        @PropertyValue("tuna")
        @PropertyValue("yellowfin")
        TUNA,

        /**
         * Sardines are small, herring-like fish commonly served in cans.
         * Sardines are considered prey fish and feed almost exclusively on
         * zooplankton.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Sardine">Sardine (Wikipedia)</a>
         */
        @PropertyValue("sardine")
        SARDINE

    }

    /**
     * Example enum consisting of a small set of possible vegetables. None of
     * the values of this enum are annotated with {@link PropertyValue}.
     */
    public static enum Vegetable {

        /**
         * Potatoes are starchy root vegetables native to the Americas. The
         * tuber itself is edible, but other parts can be toxic.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Potato">Potato (Wikipedia)</a>
         */
        POTATO,

        /**
         * Carrots are root vegetables, tapered in shape and generally orange
         * in color.
         *
         * @see <a href="https://en.wikipedia.org/wiki/Carrot">Carrot (Wikipedia)</a>
         */
        CARROT

    }

    /**
     * Example Guacamole property which parses String values as Fish constants.
     */
    private static final EnumGuacamoleProperty<Fish> FAVORITE_FISH = new EnumGuacamoleProperty<Fish>(Fish.class) {

        @Override
        public String getName() {
            return "favorite-fish";
        }

    };

    /**
     * Verifies that EnumGuacamoleProperty correctly parses string values that
     * are associated with their corresponding enum constants using the
     * {@link PropertyValue} annotation.
     *
     * @throws GuacamoleException
     *     If a valid test value is incorrectly recognized by parseValue() as
     *     invalid.
     */
    @Test
    public void testParseValue() throws GuacamoleException {
        assertEquals(Fish.SALMON,   FAVORITE_FISH.parseValue("salmon"));
        assertEquals(Fish.TROUT,    FAVORITE_FISH.parseValue("trout"));
        assertEquals(Fish.MACKEREL, FAVORITE_FISH.parseValue("mackerel"));
        assertEquals(Fish.TUNA,     FAVORITE_FISH.parseValue("tuna"));
        assertEquals(Fish.TUNA,     FAVORITE_FISH.parseValue("yellowfin"));
        assertEquals(Fish.SARDINE,  FAVORITE_FISH.parseValue("sardine"));
    }

    /**
     * Verifies that the absence of a property value (null) is parsed by
     * EnumGuacamoleProperty as the absence of an enum constant (also null).
     *
     * @throws GuacamoleException
     *     If a valid test value is incorrectly recognized by parseValue() as
     *     invalid.
     */
    @Test
    public void testParseNullValue() throws GuacamoleException {
        assertNull(FAVORITE_FISH.parseValue(null));
    }

    /**
     * Verifies that GuacamoleException is thrown when attempting to parse an
     * invalid value, and that the error message contains a sorted list of all
     * allowed values.
     */
    @Test
    public void testParseInvalidValue() {
        try {
            FAVORITE_FISH.parseValue("anchovy");
            fail("Invalid EnumGuacamoleProperty values should fail to parse with an exception.");
        }
        catch (GuacamoleException e) {
            String message = e.getMessage();
            assertTrue(message.contains("\"mackerel\", \"salmon\", \"sardine\", \"trout\", \"tuna\", \"yellowfin\""));
        }
    }

    /**
     * Verifies that EnumGuacamoleProperty can be constructed for enums that
     * are not annotated with {@link PropertyValue}.
     *
     * @throws GuacamoleException
     *     If a valid test value is incorrectly recognized by parseValue() as
     *     invalid.
     */
    @Test
    public void testUnannotatedEnum() throws GuacamoleException {

        EnumGuacamoleProperty<Vegetable> favoriteVegetable = new EnumGuacamoleProperty<Vegetable>(
                "potato", Vegetable.POTATO,
                "carrot", Vegetable.CARROT
        ) {

            @Override
            public String getName() {
                return "favorite-vegetable";
            }

        };

        assertEquals(Vegetable.POTATO, favoriteVegetable.parseValue("potato"));
        assertEquals(Vegetable.CARROT, favoriteVegetable.parseValue("carrot"));

    }

    /**
     * Verifies that an IllegalArgumentException is thrown if key/value pairs
     * are provided in the wrong order (value followed by key instead of key
     * followed by value).
     */
    @Test
    public void testUnannotatedEnumBadOrder() {

        try {

            new EnumGuacamoleProperty<Vegetable>(
                    "potato", Vegetable.POTATO,
                    Vegetable.CARROT, "carrot"
            ) {

                @Override
                public String getName() {
                    return "favorite-vegetable";
                }

            };

            fail("EnumGuacamoleProperty should not accept key/value pairs in value/key order.");

        }
        catch (IllegalArgumentException e) {
            // Success
        }

    }

    /**
     * Verifies that an IllegalArgumentException is thrown if constants from
     * the wrong enum are provided in an explicit mapping.
     */
    @Test
    public void testUnannotatedEnumBadValue() {

        try {

            new EnumGuacamoleProperty<Vegetable>(
                    "potato", Vegetable.POTATO,
                    "carrot", Fish.TROUT
            ) {

                @Override
                public String getName() {
                    return "favorite-vegetable";
                }

            };

            fail("EnumGuacamoleProperty should not accept values from the wrong enum.");

        }
        catch (IllegalArgumentException e) {
            // Success
        }

    }

    /**
     * Verifies that an IllegalArgumentException is thrown if non-String keys
     * are provided in an explicit mapping.
     */
    @Test
    public void testUnannotatedEnumBadKey() {

        try {

            new EnumGuacamoleProperty<Vegetable>(
                    "potato", Vegetable.POTATO,
                    1, Vegetable.CARROT
            ) {

                @Override
                public String getName() {
                    return "favorite-vegetable";
                }

            };

            fail("EnumGuacamoleProperty should not accept keys that are not Strings.");

        }
        catch (IllegalArgumentException e) {
            // Success
        }

    }

    /**
     * Verifies that an IllegalArgumentException is thrown if the length of the
     * {@code additional} array is not even.
     */
    @Test
    public void testUnannotatedEnumBadLength() {

        try {

            new EnumGuacamoleProperty<Vegetable>(
                    "potato", Vegetable.POTATO,
                    1, Vegetable.CARROT, 2
            ) {

                @Override
                public String getName() {
                    return "favorite-vegetable";
                }

            };

            fail("EnumGuacamoleProperty should not accept additional key/value pairs from an array that is not even in length.");

        }
        catch (IllegalArgumentException e) {
            // Success
        }

    }

    /**
     * Verifies that explicit string/constant mappings take priority over the
     * {@link PropertyValue} annotation when both are used.
     *
     * @throws GuacamoleException
     *     If a valid test value is incorrectly recognized by parseValue() as
     *     invalid.
     */
    @Test
    public void testAnnotationPrecedence() throws GuacamoleException {

        EnumGuacamoleProperty<Fish> favoriteFish = new EnumGuacamoleProperty<Fish>(
                "chinook", Fish.SALMON,
                "rainbow", Fish.TROUT
        ) {

            @Override
            public String getName() {
                return "favorite-fish";
            }

        };

        assertEquals(Fish.SALMON, favoriteFish.parseValue("chinook"));
        assertEquals(Fish.TROUT, favoriteFish.parseValue("rainbow"));

        try {
            favoriteFish.parseValue("salmon");
            fail("Explicit key/value mapping should take priority over annotations.");
        }
        catch (GuacamoleException e) {
            // Success
        }

        try {
            favoriteFish.parseValue("trout");
            fail("Explicit key/value mapping should take priority over annotations.");
        }
        catch (GuacamoleException e) {
            // Success
        }

        try {
            favoriteFish.parseValue("tuna");
            fail("Annotations should not have any effect if explicit key/value mapping is used.");
        }
        catch (GuacamoleException e) {
            // Success
        }

    }

}
