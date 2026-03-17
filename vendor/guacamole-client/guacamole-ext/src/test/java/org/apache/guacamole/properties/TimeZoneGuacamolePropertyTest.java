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

import java.util.Arrays;
import java.util.List;
import java.util.TimeZone;
import org.apache.guacamole.GuacamoleException;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 * Tests that validate Time Zone property input.
 */
public class TimeZoneGuacamolePropertyTest {
    
    /**
     * An array of valid TimeZones that should be correct parsed by the TimeZone
     * property, returning either the same or synonymous zone.
     */
    private static final List<String> TZ_TEST_VALID = Arrays.asList(
            "America/Los_Angeles",
            "America/New_York",
            "Australia/Sydney",
            "Africa/Johannesburg",
            "Asia/Shanghai"
    );
    
    /**
     * An array of invalid timezone names that should be parsed to GMT, which
     * should cause an exception to be thrown by the TimeZone property.
     */
    private static final List<String> TZ_TEST_INVALID = Arrays.asList(
            "Chips/Guacamole",
            "Chips/Queso",
            "Chips/Salsa",
            "Mashed/Avacado",
            "Pico/De_Guayo"
    );
    
    /**
     * An array of valid GMT specifications that should be correctly parsed
     * by the TimeZone property as GMT.
     */
    private static final List<String> TZ_GMT_VALID = Arrays.asList(
            "GMT",
            "GMT-0000",
            "GMT+000",
            "GMT+00:00",
            "GMT-0:00",
            "GMT+0"
    );
    
    /**
     * An array of invalid GMT specifications that should cause an exception to
     * be thrown for the TimeZone property.
     */
    private static final List<String> TZ_GMT_INVALID = Arrays.asList(
            "GMTx0000",
            "GMT=00:00",
            "GMT0:00",
            "GMT+000000",
            "GMT-000:000",
            "GMT100"
    );
    
    /**
     * An array of custom GMT offsets that should evaluate correctly for
     * the TimeZone property.
     */
    private static final List<String> TZ_CUSTOM_VALID = Arrays.asList(
            "GMT-23:59",
            "GMT+01:30",
            "GMT-00:30",
            "GMT-11:25"
    );
    
    /**
     * An array of invalid custom GMT offsets that should cause an exception
     * to be thrown by the TimeZone property.
     */
    private static final List<String> TZ_CUSTOM_INVALID = Arrays.asList(
            "GMT-9999",
            "GMT+2500",
            "GMT+29:30",
            "GMT-1:99",
            "GMT+10:65"
    );
    
    /**
     * The list of all available timezones that are known to the TimeZone class.
     */
    private static final List<String> TZ_AVAIL_IDS =
            Arrays.asList(TimeZone.getAvailableIDs());
    
    /**
     * An example TimeZoneGuacamoleProperty for testing how various possible
     * TimeZone values will be parsed.
     */
    private static final TimeZoneGuacamoleProperty WHERE_IN_WORLD =
            new TimeZoneGuacamoleProperty() {
            
        @Override
        public String getName() {
            return "carmen-sandiego";
        }
        
    };
    
    /**
     * Tests to verify that each of the items in this list returns a valid,
     * non-GMT timezone.
     * 
     * @throws GuacamoleException 
     *     If a test value fails to parse correctly as a non-GMT timezone.
     */
    @Test
    public void testValidTZs() throws GuacamoleException {
        for (String tzStr : TZ_TEST_VALID) {
            String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
            assertFalse(TimeZoneGuacamoleProperty.GMT_REGEX.matcher(tzId).matches());
        }
    }
    
    /**
     * Tests invalid time zones to make sure that they produce the desired
     * result, which is an exception thrown failing to parse the value.
     */
    @Test
    public void testInvalidTZs() {
        TZ_TEST_INVALID.forEach((tzStr) -> {
            try {
                String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
                fail("Invalid TimeZoneGuacamoleProperty should fail to parse with an exception.");
            }
            catch (GuacamoleException e) {
                String msg = e.getMessage();
                assertTrue(msg.contains("does not specify a valid time zone"));
            }
        });
    }
    
    /**
     * Tests a list of strings that should be valid representations of the GMT
     * time zone, throwing an exception if an invalid String is found.
     * 
     * @throws GuacamoleException 
     *     If the test value incorrectly fails to parse as a valid GMT string.
     */
    @Test
    public void testValidGMT() throws GuacamoleException {
        for (String tzStr : TZ_GMT_VALID) {
            String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
            assertNotNull(tzId);
        }
    }
    
    /**
     * Tests various invalid GMT representations to insure that parsing of these
     * values fails and the expected GuacamoleException is thrown.
     */
    @Test
    public void testInvalidGMT() {
        TZ_GMT_INVALID.forEach((tzStr) -> {
            try {
                String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
                fail("Invalid GMT value \"" + tzStr + "\" for TimeZoneGuacamoleProperty should fail to parse with an exception.");
            }
            catch (GuacamoleException e) {
                String msg = e.getMessage();
                assertTrue(msg.contains("does not specify a valid time zone"));
            }
        });
    }
    
    /**
     * Tests several custom offsets from GMT to make sure that they are returned
     * as valid TimeZone objects.
     * 
     * @throws GuacamoleException 
     *     If the test unexpectedly fails because a custom offset throws an
     *     exception as an invalid TimeZone.
     */
    @Test
    public void testValidCustomTz() throws GuacamoleException {
        for (String tzStr : TZ_CUSTOM_VALID) {
            String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
            assertNotNull(tzId);
        }
    }
    
    /**
     * Tests several invalid custom timezone offsets to make sure that they are
     * not accepted as valid timezones.
     */
    @Test
    public void testInvalidCustomTz() {
        TZ_CUSTOM_INVALID.forEach((tzStr) -> {
            try {
                String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
                fail("Invalid custom time zone value \"" + tzStr + "\" for TimeZoneGuacamoleProperty should fail to parse with an exception.");
            }
            catch (GuacamoleException e) {
                String msg = e.getMessage();
                assertTrue(msg.contains("does not specify a valid time zone"));
            }
        });
    }
    
    /**
     * Tests the list of available identifiers provided by the TimeZone class
     * to make sure that all identifiers provided pass through successfully and
     * do not yield unexpected results.
     * 
     * @throws GuacamoleException 
     *     If the test fails unexpectedly because the timezone is not recognized
     *     and is converted to GMT.
     */
    public void availTzCheck() throws GuacamoleException {
        for (String tzStr : TZ_AVAIL_IDS) {
            String tzId = WHERE_IN_WORLD.parseValue(tzStr).getID();
            assertNotNull(tzId);
            assertTrue(tzId.equals(tzStr));
        }
    }
    
    /**
     * Tests parse of null input values to make sure the resuling parsed value
     * is also null.
     * 
     * @throws GuacamoleException
     *     If the test unexpectedly fails parsing a null value instead
     *     recognizing it as an invalid value.
     */
    @Test
    public void nullTzCheck() throws GuacamoleException {
        assertNull(WHERE_IN_WORLD.parseValue(null));
    }
    
    
}
