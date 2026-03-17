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

package org.apache.guacamole.protocol;

import org.junit.Assert;
import org.junit.Test;

/**
 * Unit test for GuacamoleProtocolVersion. Verifies that Guacamole protocol
 * version string parsing works as required.
 */
public class GuacamoleProtocolVersionTest {

    /**
     * Verifies that valid version strings are parsed successfully.
     */
    @Test
    public void testValidVersionParse() {
        GuacamoleProtocolVersion version = GuacamoleProtocolVersion.parseVersion("VERSION_012_102_398");
        Assert.assertNotNull(version);
        Assert.assertEquals(12, version.getMajor());
        Assert.assertEquals(102, version.getMinor());
        Assert.assertEquals(398, version.getPatch());
    }

    /**
     * Verifies that invalid version strings fail to parse.
     */
    @Test
    public void testInvalidVersionParse() {

        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("potato"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION___"));

        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION__2_3"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_1__3"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_1_2_"));

        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_A_2_3"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_1_B_3"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("VERSION_1_2_C"));

        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("_1_2_3"));
        Assert.assertNull(GuacamoleProtocolVersion.parseVersion("version_1_2_3"));

    }

    /**
     * Verifies that the atLeast() function defined by GuacamoleProtocolVersion
     * behaves as required for a series of three versions which are in strictly
     * increasing order (a &lt; b &lt; c).
     *
     * @param a
     *     The String representation of the version which is known to be the
     *     smaller than versions b and c.
     *
     * @param b
     *     The String representation of the version which is known to be
     *     larger than version a but smaller than version c.
     *
     * @param c
     *     The String representation of the version which is known to be the
     *     larger than versions a and b.
     */
    private void testVersionCompare(String a, String b, String c) {

        GuacamoleProtocolVersion verA = GuacamoleProtocolVersion.parseVersion(a);
        GuacamoleProtocolVersion verB = GuacamoleProtocolVersion.parseVersion(b);
        GuacamoleProtocolVersion verC = GuacamoleProtocolVersion.parseVersion(c);

        Assert.assertTrue(verC.atLeast(verB));
        Assert.assertTrue(verC.atLeast(verA));
        Assert.assertTrue(verB.atLeast(verA));

        Assert.assertFalse(verB.atLeast(verC));
        Assert.assertFalse(verA.atLeast(verC));
        Assert.assertFalse(verA.atLeast(verB));

        Assert.assertTrue(verA.atLeast(verA));
        Assert.assertTrue(verB.atLeast(verB));
        Assert.assertTrue(verC.atLeast(verC));

    }

    /**
     * Verifies that version order comparisons using atLeast() behave as
     * required.
     */
    @Test
    public void testVersionCompare() {
        testVersionCompare("VERSION_0_0_1", "VERSION_0_0_2", "VERSION_0_0_3");
        testVersionCompare("VERSION_0_1_0", "VERSION_0_2_0", "VERSION_0_3_0");
        testVersionCompare("VERSION_1_0_0", "VERSION_2_0_0", "VERSION_3_0_0");
        testVersionCompare("VERSION_1_2_3", "VERSION_1_3_3", "VERSION_2_0_0");
    }

    /**
     * Verifies that versions can be tested for equality using equals().
     */
    @Test
    public void testVersionEquals() {

        GuacamoleProtocolVersion version;

        version = GuacamoleProtocolVersion.parseVersion("VERSION_012_102_398");
        Assert.assertTrue(version.equals(version));
        Assert.assertTrue(version.equals(new GuacamoleProtocolVersion(12, 102, 398)));
        Assert.assertFalse(version.equals(new GuacamoleProtocolVersion(12, 102, 399)));
        Assert.assertFalse(version.equals(new GuacamoleProtocolVersion(12, 103, 398)));
        Assert.assertFalse(version.equals(new GuacamoleProtocolVersion(11, 102, 398)));

        version = GuacamoleProtocolVersion.parseVersion("VERSION_1_0_0");
        Assert.assertTrue(version.equals(GuacamoleProtocolVersion.VERSION_1_0_0));
        Assert.assertFalse(version.equals(GuacamoleProtocolVersion.VERSION_1_1_0));

        version = GuacamoleProtocolVersion.parseVersion("VERSION_1_1_0");
        Assert.assertTrue(version.equals(GuacamoleProtocolVersion.VERSION_1_1_0));
        Assert.assertFalse(version.equals(GuacamoleProtocolVersion.VERSION_1_0_0));

    }

    /**
     * Verifies that versions can be converted to their Guacamole protocol
     * representation through calling toString().
     */
    @Test
    public void testToString() {
        Assert.assertEquals("VERSION_1_0_0", GuacamoleProtocolVersion.VERSION_1_0_0.toString());
        Assert.assertEquals("VERSION_1_1_0", GuacamoleProtocolVersion.VERSION_1_1_0.toString());
        Assert.assertEquals("VERSION_12_103_398", new GuacamoleProtocolVersion(12, 103, 398).toString());
    }

}
