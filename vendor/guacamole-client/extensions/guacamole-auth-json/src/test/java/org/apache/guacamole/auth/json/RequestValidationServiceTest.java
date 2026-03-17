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

package org.apache.guacamole.auth.json;

import java.io.BufferedReader;
import java.security.Principal;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import javax.servlet.ServletInputStream;
import javax.servlet.RequestDispatcher;
import org.apache.guacamole.net.auth.Credentials;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Unit test for RequestValidationService. Verifies that only requests
 * from trusted hosts are allowed to authenticate.
 */
public class RequestValidationServiceTest {

    /**
     * This class is used to mock ConfigurationService.
     */
    private class MockConfigurationService extends ConfigurationService {

        /**
         * List of networks to be trusted
         */
        private Collection<String> trustedNetworks;

        /**
         * Constructor that enables passing of a comma-separated list of
         * trusted networks.
         *
         * @param trustedNetworks
         *     The comma-separated list of trusted networks
         */
        private MockConfigurationService(String trustedNetworks) {
            if (trustedNetworks == null || trustedNetworks.isEmpty())
                this.trustedNetworks = Collections.<String>emptyList();
            else
                this.trustedNetworks = Arrays.asList(Pattern.compile(",\\s*").split(trustedNetworks));
        }

        @Override
        public Collection<String> getTrustedNetworks() {
            return trustedNetworks;
        }

    }

    /**
     * The instance of RequestValidationService to be tested.
     */
    private RequestValidationService requestService;

    /**
     * Method that returns a (mock) HttpServletRequest with the provided
     * remote address.
     *
     * @param remoteAddr
     *     The remote address of the request
     */
    private static HttpServletRequest mockHttpServletRequest(String remoteAddr) {

        return new HttpServletRequest() {

            @Override
            public Object getAttribute(String name) {
                return null;
            }

            @Override
            public Enumeration<String> getAttributeNames() {
                return null;
            }

            @Override
            public String getAuthType() {
                return null;
            }

            @Override
            public String getCharacterEncoding() {
                return null;
            }

            @Override
            public int getContentLength() {
                return 0;
            }

            @Override
            public String getContentType() {
                return null;
            }

            @Override
            public String getContextPath() {
                return null;
            }

            @Override
            public Cookie[] getCookies() {
                return null;
            }

            @Override
            public long getDateHeader(String name) {
                return 0;
            }

            @Override
            public String getHeader(String name) {
                return null;
            }

            @Override
            public Enumeration<String> getHeaderNames() {
                return null;
            }

            @Override
            public Enumeration<String> getHeaders(String name) {
                return null;
            }

            @Override
            public ServletInputStream getInputStream() {
                return null;
            }

            @Override
            public int getIntHeader(String name) {
                return 0;
            }

            @Override
            public String getLocalAddr() {
                return null;
            }

            @Override
            public Locale getLocale() {
                return null;
            }

            @Override
            public Enumeration<Locale> getLocales() {
                return null;
            }

            @Override
            public String getLocalName() {
                return null;
            }

            @Override
            public int getLocalPort() {
                return 0;
            }

            @Override
            public String getMethod() {
                return null;
            }

            @Override
            public String getParameter(String name) {
                return null;
            }

            @Override
            public Map<String,String[]> getParameterMap() {
                return null;
            }

            @Override
            public Enumeration<String> getParameterNames() {
                return null;
            }

            @Override
            public String[] getParameterValues(String name) {
                return null;
            }

            @Override
            public String getPathInfo() {
                return null;
            }

            @Override
            public String getPathTranslated() {
                return null;
            }

            @Override
            public String getProtocol() {
                return null;
            }

            @Override
            public String getQueryString() {
                return null;
            }

            @Override
            public BufferedReader getReader() {
                return null;
            }

            @Override
            @Deprecated
            public String getRealPath(String path) {
                return null;
            }

            @Override
            public String getRemoteAddr() {
                return remoteAddr;
            }

            @Override
            public String getRemoteHost() {
                return null;
            }

            @Override
            public int getRemotePort() {
                return 0;
            }

            @Override
            public String getRemoteUser() {
                return null;
            }

            @Override
            public RequestDispatcher getRequestDispatcher(String path) {
                return null;
            }

            @Override
            public String getRequestedSessionId() {
                return null;
            }

            @Override
            public String getRequestURI() {
                return null;
            }

            @Override
            public StringBuffer getRequestURL() {
                return null;
            }

            @Override
            public String getScheme() {
                return null;
            }

            @Override
            public String getServerName() {
                return null;
            }

            @Override
            public int getServerPort() {
                return 0;
            }

            @Override
            public String getServletPath() {
                return null;
            }

            @Override
            public HttpSession getSession() {
                return null;
            }

            @Override
            public HttpSession getSession(boolean create) {
                return null;
            }

            @Override
            public Principal getUserPrincipal() {
                return null;
            }

            @Override
            public boolean isRequestedSessionIdFromCookie() {
                return false;
            }

            @Override
            @Deprecated
            public boolean isRequestedSessionIdFromUrl() {
                return false;
            }

            @Override
            public boolean isRequestedSessionIdFromURL() {
                return false;
            }

            @Override
            public boolean isRequestedSessionIdValid() {
                return false;
            }

            @Override
            public boolean isSecure() {
                return false;
            }

            @Override
            public boolean isUserInRole(String role) {
                return false;
            }

            @Override
            public void removeAttribute(String name) {
                return;
            }

            @Override
            public void setAttribute(String name, Object o) {
                return;
            }

            @Override
            public void setCharacterEncoding(String env) {
                return;
            }

        };

    };

    /**
     * Verifies that all hosts are allowed to authenticate when no
     * trusted networks are specified.
     */
    @Test
    public void testNoTrustedNetwork() {

        requestService = new RequestValidationService(new MockConfigurationService(null));

        try {
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1.1.1.1"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("10.10.10.10"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("100.100.100.100"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1:1:1:1:1:1:1:1"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("10:10:10:10:10:10:10:10"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("100:100:100:100:100:100:100:100"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1000:1000:1000:1000:1000:1000:1000:1000"))));
        }
        catch (AssertionError e) {
            fail("A network was denied to authenticate even though no trusted networks were specified.");
        }

    }

    /**
     * Verifies that hosts from trusted networks are allowed to
     * authenticate:
     */
    @Test
    public void testTrustedNetwork() {

        requestService = new RequestValidationService(new MockConfigurationService("10.0.0.0/8,127.0.0.0/8,172.16.0.0/12,192.168.0.0/16,1.2.3.4/32,::1/128,fc00::/7"));

        try {
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("10.0.0.0"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("10.255.255.255"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("127.0.0.0"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("127.255.255.255"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("172.16.0.0"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("172.31.255.255"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("192.168.0.0"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("192.168.255.255"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1.2.3.4"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("::1"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("fc00::"))));
            assertTrue(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"))));
        }
        catch (AssertionError e) {
            fail("A trusted network was denied to authenticate.");
        }

    }

    /**
     * Verifies that hosts outside trusted networks are not allowed to
     * authenticate.
     */
    @Test
    public void testUntrustedNetwork() {

        requestService = new RequestValidationService(new MockConfigurationService("10.0.0.0/8,127.0.0.0/8,172.16.0.0/12,192.168.0.0/16,1.2.3.4/32,::1/128,fc00::/7"));

        try {
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("9.255.255.255"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("11.0.0.0"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("126.255.255.255"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("128.0.0.0"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("172.15.255.255"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("172.32.0.0"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("192.167.255.255"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("192.169.0.0"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1.2.3.3"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("1.2.3.5"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("::0"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("::2"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("fbff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"))));
            assertFalse(requestService.isAuthenticationAllowed(new Credentials(null, null, mockHttpServletRequest("fe00::"))));
        }
        catch (AssertionError e) {
            fail("An untrusted network was allowed to authenticate.");
        }

    }

}
