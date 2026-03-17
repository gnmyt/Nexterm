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

package org.apache.guacamole.auth.ssl.conf;

import com.google.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Collection;
import javax.naming.ldap.LdapName;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;
import org.apache.guacamole.properties.URIGuacamoleProperty;

/**
 * Service for retrieving configuration information regarding SSO using SSL/TLS
 * authentication.
 */
public class ConfigurationService {

    /**
     * The default name of the header to use to retrieve the URL-encoded client
     * certificate from an HTTP request received from an SSL termination
     * service providing SSL/TLS client authentication.
     */
    private static String DEFAULT_CLIENT_CERTIFICATE_HEADER = "X-Client-Certificate";

    /**
     * The default name of the header to use to retrieve the verification
     * status of the certificate an HTTP request received from an SSL
     * termination service providing SSL/TLS client authentication.
     */
    private static String DEFAULT_CLIENT_VERIFIED_HEADER = "X-Client-Verified";

    /**
     * The default amount of time that a temporary authentication token for
     * SSL/TLS authentication may remain valid, in minutes.
     */
    private static int DEFAULT_MAX_TOKEN_VALIDITY = 5;

    /**
     * The default amount of time that the temporary, unique subdomain
     * generated for SSL/TLS authentication may remain valid, in minutes.
     */
    private static int DEFAULT_MAX_DOMAIN_VALIDITY = 5;

    /**
     * The property representing the URI that should be used to authenticate
     * users with SSL/TLS client authentication. This must be a URI that points
     * to THIS instance of Guacamole, but behind SSL termination that requires
     * SSL/TLS client authentication.
     */
    private static final WildcardURIGuacamoleProperty SSL_AUTH_URI =
            new WildcardURIGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-uri"; }

    };

    /**
     * The property representing the URI of this instance without SSL/TLS
     * client authentication required. This must be a URI that points
     * to THIS instance of Guacamole, but behind SSL termination that DOES NOT
     * require or request SSL/TLS client authentication.
     */
    private static final URIGuacamoleProperty SSL_AUTH_PRIMARY_URI =
            new URIGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-primary-uri"; }

    };

    /**
     * The property representing the name of the header to use to retrieve the
     * URL-encoded client certificate from an HTTP request received from an
     * SSL termination service providing SSL/TLS client authentication.
     */
    private static final StringGuacamoleProperty SSL_AUTH_CLIENT_CERTIFICATE_HEADER =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-client-certificate-header"; }

    };

    /**
     * The property representing the name of the header to use to retrieve the
     * verification status of the certificate an HTTP request received from an
     * SSL termination service providing SSL/TLS client authentication. This
     * value of this header must be "SUCCESS" (all uppercase) if the
     * certificate was successfully verified.
     */
    private static final StringGuacamoleProperty SSL_AUTH_CLIENT_VERIFIED_HEADER =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-client-verified-header"; }

    };

    /**
     * The property representing the amount of time that a temporary
     * authentication token for SSL/TLS authentication may remain valid, in
     * minutes. This token is used to represent the user's asserted identity
     * after it has been verified by the SSL termination service. This interval
     * must be long enough to allow for network delays in receiving the token,
     * but short enough that unused tokens do not consume unnecessary server
     * resources and cannot potentially be guessed while the token is still
     * valid. These tokens are 256-bit secure random values.
     */
    private static final IntegerGuacamoleProperty SSL_AUTH_MAX_TOKEN_VALIDITY =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-max-token-validity"; }

    };

    /**
     * The property defining the LDAP attribute or attributes that may be used
     * to represent a username within the subject DN of a user's X.509
     * certificate. If the least-significant attribute of the subject DN is not
     * one of these attributes, the certificate will be rejected. By default,
     * any attribute is accepted.
     */
    private static final StringGuacamoleProperty SSL_AUTH_SUBJECT_USERNAME_ATTRIBUTE =
            new StringGuacamoleProperty () {

        @Override
        public String getName() { return "ssl-auth-subject-username-attribute"; }

    };

    /**
     * The property defining the base DN containing all valid subject DNs. If
     * specified, only certificates asserting subject DNs beneath this base DN
     * will be accepted. By default, all DNs are accepted.
     */
    private static final LdapNameGuacamoleProperty SSL_AUTH_SUBJECT_BASE_DN =
            new LdapNameGuacamoleProperty () {

        @Override
        public String getName() { return "ssl-auth-subject-base-dn"; }

    };

    /**
     * The property representing the amount of time that the temporary, unique
     * subdomain generated for SSL/TLS authentication may remain valid, in
     * minutes. This subdomain is used to ensure each SSL/TLS authentication
     * attempt is fresh and does not potentially reuse a previous
     * authentication attempt that was cached by the browser or OS. This
     * interval must be long enough to allow for network delays in
     * authenticating the user with the SSL termination service that enforces
     * SSL/TLS client authentication, but short enough that an unused domain
     * does not consume unnecessary server resources and cannot potentially be
     * guessed while that subdomain is still valid. These subdomains are
     * 128-bit secure random values.
     */
    private static final IntegerGuacamoleProperty SSL_AUTH_MAX_DOMAIN_VALIDITY =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ssl-auth-max-domain-validity"; }

    };

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Returns whether the given hostname matches the hostname of the given
     * URI. The provided hostname may be the value of an HTTP "Host" header,
     * and may include a port number. If a port number is included in the
     * hostname, it is ignored.
     *
     * @param hostname
     *     The hostname to check, which may alternatively be the value of an
     *     HTTP "Host" header, with or without port number. The port number is
     *     not considered when determining whether this hostname matches the
     *     hostname of the provided URI.
     *
     * @param offset
     *     The character offset within the provided hostname where checking
     *     should start. Any characters before this offset are ignored. This
     *     offset does not affect where checking starts within the hostname of
     *     the provided URI.
     *
     * @param uri
     *     The URI to check the given hostname against.
     *
     * @return
     *     true if the provided hostname from the given offset onward is
     *     identical to the hostname of the given URI, false otherwise.
     */
    private boolean hostnameMatches(String hostname, int offset, URI uri) {

        // Locate end of actual hostname portion of "Host" header
        int endOfHostname = hostname.indexOf(':');
        if (endOfHostname == -1)
            endOfHostname = hostname.length();

        // Before checking substring equivalence, we need to verify that the
        // length actually matches what we expect (we'd otherwise consider the
        // host to match if it starts with the expected hostname, ignoring any
        // remaining characters)
        String expectedHostname = uri.getHost();
        if (expectedHostname.length() != endOfHostname - offset)
            return false;

        return hostname.regionMatches(true, offset, expectedHostname, 0, expectedHostname.length());

    }

    /**
     * Returns a URI that should be used to authenticate users with SSL/TLS
     * client authentication. The returned URI will consist of the configured
     * client authentication URI with the wildcard portion ("*.") replaced with
     * the given subdomain.
     *
     * @param subdomain
     *     The subdomain that should replace the wildcard portion of the
     *     configured client authentication URI.
     *
     * @return
     *     A URI that should be used to authenticate users with SSL/TLS
     *     client authentication.
     *
     * @throws GuacamoleException
     *     If the required property for configuring the client authentication
     *     URI is missing or cannot be parsed.
     */
    public URI getClientAuthenticationURI(String subdomain) throws GuacamoleException {

        URI authURI = environment.getRequiredProperty(SSL_AUTH_URI);
        String baseHostname = authURI.getHost();

        // Add provided subdomain to auth URI
        return UriBuilder.fromUri(authURI)
                .host(subdomain + "." + baseHostname)
                .build();

    }

    /**
     * Given a hostname that was used by a user for SSL/TLS client
     * authentication, returns the subdomain at the beginning of that hostname.
     * If the hostname does not match the pattern of hosts represented by the
     * configured client authentication URI, null is returned.
     *
     * @param hostname
     *     The hostname to extract the subdomain from.
     *
     * @return
     *     The subdomain at the beginning of the provided hostname, if that
     *     hostname matches the pattern of hosts represented by the
     *     configured client authentication URI, or null otherwise.
     *
     * @throws GuacamoleException
     *     If the required property for configuring the client authentication
     *     URI is missing or cannot be parsed.
     */
    public String getClientAuthenticationSubdomain(String hostname) throws GuacamoleException {

        // Any hostname that matches the explicitly-specific primary URI is not
        // a client auth subdomain
        if (isPrimaryHostname(hostname))
            return null;

        // Verify the first domain component is at least one character in
        // length
        int firstPeriod = hostname.indexOf('.');
        if (firstPeriod <= 0)
            return null;

        // Verify domain matches the configured auth URI except for the leading
        // subdomain
        URI authURI = environment.getRequiredProperty(SSL_AUTH_URI);
        if (!hostnameMatches(hostname, firstPeriod + 1, authURI))
            return null;

        // Extract subdomain
        return hostname.substring(0, firstPeriod);

    }

    /**
     * Returns the URI of this instance without SSL/TLS client authentication
     * required.
     *
     * @return
     *     The URI of this instance without SSL/TLS client authentication
     *     required.
     *
     * @throws GuacamoleException
     *     If the required property for configuring the primary URI is missing
     *     or cannot be parsed.
     */
    public URI getPrimaryURI() throws GuacamoleException {
        return environment.getRequiredProperty(SSL_AUTH_PRIMARY_URI);
    }

    /**
     * Returns the HTTP request origin for requests originating from this
     * instance via the primary URI (as returned by {@link #getPrimaryURI()}.
     * This value is essentially the same as the primary URI but with only the
     * scheme, host, and port present.
     *
     * @return
     *     The HTTP request origin for requests originating from this instance
     *     via the primary URI.
     *
     * @throws GuacamoleException
     *     If the required property for configuring the primary URI is missing
     *     or cannot be parsed.
     */
    public URI getPrimaryOrigin() throws GuacamoleException {
        URI primaryURI = getPrimaryURI();
        try {
            return new URI(primaryURI.getScheme(), null, primaryURI.getHost(), primaryURI.getPort(), null, null, null);
        }
        catch (URISyntaxException e) {
            throw new GuacamoleServerException("Request origin could not be "
                    + "derived from the configured primary URI.", e);
        }
    }

    /**
     * Returns whether the given hostname is the same as the hostname in the
     * primary URI (as returned by {@link #getPrimaryURI()}. Hostnames are
     * case-insensitive.
     *
     * @param hostname
     *     The hostname to test.
     *
     * @return
     *     true if the hostname is the same as the hostname in the primary URI,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If the required property for configuring the primary URI is missing
     *     or cannot be parsed.
     */
    public boolean isPrimaryHostname(String hostname) throws GuacamoleException {
        URI primaryURI = getPrimaryURI();
        return hostnameMatches(hostname, 0, primaryURI);
    }

    /**
     * Returns the name of the header to use to retrieve the URL-encoded client
     * certificate from an HTTP request received from an SSL termination
     * service providing SSL/TLS client authentication.
     *
     * @return
     *     The name of the header to use to retrieve the URL-encoded client
     *     certificate from an HTTP request received from an SSL termination
     *     service providing SSL/TLS client authentication.
     *
     * @throws GuacamoleException
     *     If the property for configuring the client certificate header cannot
     *     be parsed.
     */
    public String getClientCertificateHeader() throws GuacamoleException {
        return environment.getProperty(SSL_AUTH_CLIENT_CERTIFICATE_HEADER, DEFAULT_CLIENT_CERTIFICATE_HEADER);
    }

    /**
     * Returns the name of the header to use to retrieve the verification
     * status of the certificate an HTTP request received from an SSL
     * termination service providing SSL/TLS client authentication.
     *
     * @return
     *     The name of the header to use to retrieve the verification
     *     status of the certificate an HTTP request received from an SSL
     *     termination service providing SSL/TLS client authentication.
     *
     * @throws GuacamoleException
     *     If the property for configuring the client verification header
     *     cannot be parsed.
     */
    public String getClientVerifiedHeader() throws GuacamoleException {
        return environment.getProperty(SSL_AUTH_CLIENT_VERIFIED_HEADER, DEFAULT_CLIENT_VERIFIED_HEADER);
    }

    /**
     * Returns the maximum amount of time that the token generated by the
     * Guacamole server representing current SSL authentication state should
     * remain valid, in minutes. This imposes an upper limit on the amount of
     * time any particular authentication request can result in successful
     * authentication within Guacamole when SSL/TLS client authentication is
     * configured. By default, this will be 5.
     *
     * @return
     *     The maximum amount of time that an SSL authentication token
     *     generated by the Guacamole server should remain valid, in minutes.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getMaxTokenValidity() throws GuacamoleException {
        return environment.getProperty(SSL_AUTH_MAX_TOKEN_VALIDITY, DEFAULT_MAX_TOKEN_VALIDITY);
    }

    /**
     * Returns the maximum amount of time that a unique client authentication
     * subdomain generated by the Guacamole server should remain valid, in
     * minutes. This imposes an upper limit on the amount of time any
     * particular authentication request can result in successful
     * authentication within Guacamole when SSL/TLS client authentication is
     * configured. By default, this will be 5.
     *
     * @return
     *     The maximum amount of time that a unique client authentication
     *     subdomain generated by the Guacamole server should remain valid, in
     *     minutes.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public int getMaxDomainValidity() throws GuacamoleException {
        return environment.getProperty(SSL_AUTH_MAX_DOMAIN_VALIDITY, DEFAULT_MAX_DOMAIN_VALIDITY);
    }

    /**
     * Returns the base DN that contains all valid subject DNs. If there is no
     * such base DN (and all subject DNs are valid), null is returned.
     *
     * @return
     *     The base DN that contains all valid subject DNs, or null if all
     *     subject DNs are valid.
     *
     * @throws GuacamoleException
     *     If the configured base DN cannot be read or is not a valid LDAP DN.
     */
    public LdapName getSubjectBaseDN() throws GuacamoleException {
        return environment.getProperty(SSL_AUTH_SUBJECT_BASE_DN);
    }

    /**
     * Returns a list of all attributes that may be used to represent a user's
     * username within their subject DN. If all attributes may be accepted,
     * null is returned.
     *
     * @return
     *     A list of all attributes that may be used to represent a user's
     *     username within their subject DN, or null if any attribute may be
     *     used.
     *
     * @throws GuacamoleException
     *     If the configured set of username attributes cannot be read.
     */
    public Collection<String> getSubjectUsernameAttributes() throws GuacamoleException {
        return environment.getPropertyCollection(SSL_AUTH_SUBJECT_USERNAME_ATTRIBUTE);
    }

}
