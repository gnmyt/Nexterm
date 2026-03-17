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

package org.apache.guacamole.auth.cas.group;

import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

/**
 * Test which confirms that the LDAPGroupParser implementation of GroupParser
 * parses CAS groups correctly.
 */
public class LDAPGroupParserTest {

    /**
     * LdapName instance representing the LDAP DN: "dc=example,dc=net".
     */
    private final LdapName exampleBaseDn;

    /**
     * Creates a new LDAPGroupParserTest that verifies the functionality of
     * LDAPGroupParser.
     *
     * @throws InvalidNameException
     *     If the static string LDAP DN of any test instance of LdapName is
     *     unexpectedly invalid.
     */
    public LDAPGroupParserTest() throws InvalidNameException {
        exampleBaseDn = new LdapName("dc=example,dc=net");
    }

    /**
     * Verifies that LDAPGroupParser correctly parses LDAP-based CAS groups
     * when no restrictions are enforced on LDAP attributes or the base DN.
     */
    @Test
    public void testParseRestrictNothing() {

        GroupParser parser = new LDAPGroupParser(null, null);

        // null input should be rejected as null
        assertNull(parser.parse(null));

        // Invalid DNs should be rejected as null
        assertNull(parser.parse(""));
        assertNull(parser.parse("foo"));

        // Valid DNs should be accepted
        assertEquals("bar", parser.parse("foo=bar"));
        assertEquals("baz", parser.parse("CN=baz,dc=example,dc=com"));
        assertEquals("baz", parser.parse("ou=baz,dc=example,dc=net"));
        assertEquals("foo", parser.parse("ou=foo,cn=baz,dc=example,dc=net"));
        assertEquals("foo", parser.parse("cn=foo,DC=example,dc=net"));
        assertEquals("bar", parser.parse("CN=bar,OU=groups,dc=example,Dc=net"));

    }

    /**
     * Verifies that LDAPGroupParser correctly parses LDAP-based CAS groups
     * when restrictions are enforced on LDAP attributes only.
     */
    @Test
    public void testParseRestrictAttribute() {

        GroupParser parser = new LDAPGroupParser("cn", null);

        // null input should be rejected as null
        assertNull(parser.parse(null));

        // Invalid DNs should be rejected as null
        assertNull(parser.parse(""));
        assertNull(parser.parse("foo"));

        // Valid DNs not using the correct attribute should be rejected as null
        assertNull(parser.parse("foo=bar"));
        assertNull(parser.parse("ou=baz,dc=example,dc=com"));
        assertNull(parser.parse("ou=foo,cn=baz,dc=example,dc=com"));

        // Valid DNs using the correct attribute should be accepted
        assertEquals("foo", parser.parse("cn=foo,DC=example,dc=net"));
        assertEquals("bar", parser.parse("CN=bar,OU=groups,dc=example,Dc=net"));
        assertEquals("baz", parser.parse("CN=baz,dc=example,dc=com"));

    }

    /**
     * Verifies that LDAPGroupParser correctly parses LDAP-based CAS groups
     * when restrictions are enforced on the LDAP base DN only.
     */
    @Test
    public void testParseRestrictBaseDN() {

        GroupParser parser = new LDAPGroupParser(null, exampleBaseDn);

        // null input should be rejected as null
        assertNull(parser.parse(null));

        // Invalid DNs should be rejected as null
        assertNull(parser.parse(""));
        assertNull(parser.parse("foo"));

        // Valid DNs outside the base DN should be rejected as null
        assertNull(parser.parse("foo=bar"));
        assertNull(parser.parse("CN=baz,dc=example,dc=com"));

        // Valid DNs beneath the base DN should be accepted
        assertEquals("foo", parser.parse("cn=foo,DC=example,dc=net"));
        assertEquals("bar", parser.parse("CN=bar,OU=groups,dc=example,Dc=net"));
        assertEquals("baz", parser.parse("ou=baz,dc=example,dc=net"));
        assertEquals("foo", parser.parse("ou=foo,cn=baz,dc=example,dc=net"));

    }

    /**
     * Verifies that LDAPGroupParser correctly parses LDAP-based CAS groups
     * when restrictions are enforced on both LDAP attributes and the base DN.
     */
    @Test
    public void testParseRestrictAll() {

        GroupParser parser = new LDAPGroupParser("cn", exampleBaseDn);

        // null input should be rejected as null
        assertNull(parser.parse(null));

        // Invalid DNs should be rejected as null
        assertNull(parser.parse(""));
        assertNull(parser.parse("foo"));

        // Valid DNs outside the base DN should be rejected as null
        assertNull(parser.parse("foo=bar"));
        assertNull(parser.parse("CN=baz,dc=example,dc=com"));

        // Valid DNs beneath the base DN but not using the correct attribute
        // should be rejected as null
        assertNull(parser.parse("ou=baz,dc=example,dc=net"));
        assertNull(parser.parse("ou=foo,cn=baz,dc=example,dc=net"));

        // Valid DNs beneath the base DN and using the correct attribute should
        // be accepted
        assertEquals("foo", parser.parse("cn=foo,DC=example,dc=net"));
        assertEquals("bar", parser.parse("CN=bar,OU=groups,dc=example,Dc=net"));

    }

}
