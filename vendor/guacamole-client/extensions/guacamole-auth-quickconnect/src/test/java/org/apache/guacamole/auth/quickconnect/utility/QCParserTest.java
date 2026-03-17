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

package org.apache.guacamole.auth.quickconnect.utility;

import java.util.Arrays;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

/**
 * Class to test methods in the QCParser utility class.
 */
public class QCParserTest {

    /**
     * Verify that the getConfiguration() method returns the expected
     * GuacamoleConfiguration object.
     * 
     * @throws GuacamoleException
     *     If the configuration cannot be parsed from the given URI or Java
     *     unexpectedly lacks UTF-8 support.
     */
    @Test
    public void testGetConfiguration() throws GuacamoleException {

        // Initialize the parser, first with no lists so all parameters are allowed
        QCParser parser = new QCParser();
        
        // Create some empty objects to test
        GuacamoleConfiguration guacConfig;
        String uri;
        
        // Test a standard SSH URI, with username and password, and parameters and values
        uri = "ssh://guacuser:guacpassword@hostname1.domain.local/?param1=value1&param2=value2";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("ssh", guacConfig.getProtocol());
        assertEquals("hostname1.domain.local", guacConfig.getParameter("hostname"));
        assertEquals("guacuser", guacConfig.getParameter("username"));
        assertEquals("guacpassword", guacConfig.getParameter("password"));
        assertEquals("value1", guacConfig.getParameter("param1"));
        assertEquals("value2", guacConfig.getParameter("param2"));

        // Test a standard RDP URI, with username/password and a parameter/value pair.
        uri = "rdp://domain%5cguacuser:adPassword123@windows1.domain.tld/?enable-sftp=true";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("rdp", guacConfig.getProtocol());
        assertEquals("windows1.domain.tld", guacConfig.getParameter("hostname"));
        assertEquals("domain\\guacuser", guacConfig.getParameter("username"));
        assertEquals("adPassword123", guacConfig.getParameter("password"));
        assertEquals("true", guacConfig.getParameter("enable-sftp"));

        // Test a VNC URI with no parameters/values
        uri = "vnc://mirror1.example.com:5910/";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("vnc", guacConfig.getProtocol());
        assertEquals("mirror1.example.com", guacConfig.getParameter("hostname"));
        assertEquals("5910", guacConfig.getParameter("port"));
        
        // Test a telnet URI with no parameters/values
        uri = "telnet://old1.example.com:23/";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("telnet", guacConfig.getProtocol());
        assertEquals("old1.example.com", guacConfig.getParameter("hostname"));
        assertEquals("23", guacConfig.getParameter("port"));
        
        // Re-initialize parser with only allowed parameters, and test
        parser = new QCParser(Arrays.asList("hostname", "username", "password", "port"), Collections.emptyList());
        uri = "rdp://domain%5cguacuser:adPassword123@windows1.domain.tld/?enable-sftp=true";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("rdp", guacConfig.getProtocol());
        assertEquals("windows1.domain.tld", guacConfig.getParameter("hostname"));
        assertEquals("domain\\guacuser", guacConfig.getParameter("username"));
        assertEquals("adPassword123", guacConfig.getParameter("password"));
        assertNull(guacConfig.getParameter("enable-sftp"));
        
        // Re-initialize parser with denied parameters, and test
        parser = new QCParser(Collections.emptyList(), Arrays.asList("password"));
        uri = "rdp://domain%5cguacuser:adPassword123@windows1.domain.tld/?enable-sftp=true";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("rdp", guacConfig.getProtocol());
        assertEquals("windows1.domain.tld", guacConfig.getParameter("hostname"));
        assertEquals("domain\\guacuser", guacConfig.getParameter("username"));
        assertNull(guacConfig.getParameter("password"));
        assertEquals("true", guacConfig.getParameter("enable-sftp"));
        
        // Re-initialize parser with both allowed and denied parameters, and test
        parser = new QCParser(Arrays.asList("hostname", "username", "password", "port"), Arrays.asList("password"));
        uri = "rdp://domain%5cguacuser:adPassword123@windows1.domain.tld/?enable-sftp=true";
        guacConfig = parser.getConfiguration(uri);
        assertEquals("rdp", guacConfig.getProtocol());
        assertEquals("windows1.domain.tld", guacConfig.getParameter("hostname"));
        assertEquals("domain\\guacuser", guacConfig.getParameter("username"));
        assertNull(guacConfig.getParameter("password"));
        assertNull(guacConfig.getParameter("enable-sftp"));

    }

}
