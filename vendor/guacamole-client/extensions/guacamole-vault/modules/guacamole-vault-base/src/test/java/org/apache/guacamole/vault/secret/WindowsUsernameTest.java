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

package org.apache.guacamole.vault.secret;

import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.List;

/**
 * Class to test the parsing functionality of the WindowsUsername class.
 */
public class WindowsUsernameTest {

    /**
     * Verify that the splitWindowsUsernameFromDomain() method correctly strips Windows
     * domains from provided usernames that include them, and does not modify
     * usernames that do not have Windows domains.
     */
    @Test
    public void testSplitWindowsUsernameFromDomain() {

        WindowsUsername usernameAndDomain;

        // If no Windows domain is present in the provided field, the username should
        // contain the entire field, and no domain should be returned
        usernameAndDomain = WindowsUsername.splitWindowsUsernameFromDomain("bob");
        assertEquals(usernameAndDomain.getUsername(), "bob");
        assertFalse(usernameAndDomain.hasDomain());

        // It should parse down-level logon name style domains
        usernameAndDomain = WindowsUsername.splitWindowsUsernameFromDomain("localhost\\bob");
        assertEquals("bob", usernameAndDomain.getUsername(), "bob");
        assertTrue(usernameAndDomain.hasDomain());
        assertEquals("localhost", usernameAndDomain.getDomain());

        // It should parse user principal name style domains
        usernameAndDomain = WindowsUsername.splitWindowsUsernameFromDomain("bob@localhost");
        assertEquals("bob", usernameAndDomain.getUsername(), "bob");
        assertTrue(usernameAndDomain.hasDomain());
        assertEquals("localhost", usernameAndDomain.getDomain());

        // It should not match if there are an invalid number of separators
        List<String> invalidSeparators = Arrays.asList(
                "bob@local@host", "local\\host\\bob",
                "bob\\local@host", "local@host\\bob");
        invalidSeparators.stream().forEach(
            invalidSeparator -> {

                // An invalid number of separators means that the parse failed -
                // there should be no detected domain, and the entire field value
                // should be returned as the username
                WindowsUsername parseOutput =
                        WindowsUsername.splitWindowsUsernameFromDomain(invalidSeparator);
                assertFalse(parseOutput.hasDomain());
                assertEquals(invalidSeparator, parseOutput.getUsername());

            });

    }

}
