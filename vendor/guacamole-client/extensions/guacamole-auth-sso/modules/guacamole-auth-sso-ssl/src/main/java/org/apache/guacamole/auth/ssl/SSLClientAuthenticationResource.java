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
package org.apache.guacamole.auth.ssl;

import com.google.inject.Inject;
import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;
import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
import javax.ws.rs.GET;
import javax.ws.rs.core.Response;
import javax.ws.rs.HeaderParam;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.ssl.conf.ConfigurationService;
import org.apache.guacamole.auth.sso.NonceService;
import org.apache.guacamole.auth.sso.SSOResource;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x500.style.RFC4519Style;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.openssl.PEMParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * REST API resource that allows the user to retrieve an opaque state value
 * representing their identity as determined by SSL/TLS client authentication.
 * The opaque value may represent a valid identity or an authentication
 * failure, and must be resubmitted within a normal Guacamole authentication
 * request to finalize the authentication process.
 */
public class SSLClientAuthenticationResource extends SSOResource {

    /**
     * The string value that the SSL termination service uses for its client
     * verification header to represent that the client certificate has been
     * verified.
     */
    private static final String CLIENT_VERIFIED_HEADER_SUCCESS_VALUE = "SUCCESS";

    /**
     * The string value that the SSL termination service uses for its client
     * verification header to represent that the client certificate is absent.
     */
    private static final String CLIENT_VERIFIED_HEADER_NONE_VALUE = "NONE";

    /**
     * The string prefix that the SSL termination service uses for its client
     * verification header to represent that the client certificate has failed
     * validation. The error message describing the nature of the failure is
     * provided by the SSL termination service after this prefix.
     */
    private static final String CLIENT_VERIFIED_HEADER_FAILED_PREFIX = "FAILED:";

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(SSLClientAuthenticationResource.class);

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Session manager for generating and maintaining unique tokens to
     * represent the authentication flow of a user who has only partially
     * authenticated. Here, these tokens represent a user that has been
     * validated by SSL termination and allow the Guacamole instance that
     * doesn't require SSL/TLS authentication to retrieve the user's identity
     * and complete the authentication process.
     */
    @Inject
    private SSLAuthenticationSessionManager sessionManager;

    /**
     * Service for validating and generating unique nonce values. Here, these
     * nonces are used specifically for generating unique domains.
     */
    @Inject
    private NonceService subdomainNonceService;

    /**
     * Retrieves a single value from the HTTP header having the given name. If
     * there are multiple HTTP headers present with this name, the first
     * matching header in the request is used. If there are no such headers in
     * the request, null is returned.
     *
     * @param headers
     *     The HTTP headers present in the request.
     *
     * @param name
     *     The name of the header to retrieve.
     *
     * @return
     *     The first value of the HTTP header having the given name, or null if
     *     there is no such header.
     */
    private String getHeader(HttpHeaders headers, String name) {

        List<String> values = headers.getRequestHeader(name);
        if (values == null || values.isEmpty())
            return null;

        return values.get(0);

    }

    /**
     * Decodes the provided URL-encoded string as UTF-8, returning the result.
     * <p>
     * NOTE: The escape() function of the Apache HTTPD server is known to not
     * encode plus signs, which can appear in the base64-encoded certificates
     * typically received here. To avoid mangling such certificates, this
     * function specifically avoids decoding plus signs as spaces (as would
     * otherwise happen if URLDecoder is used directly).
     *
     * @param value
     *     The URL-encoded string to decode.
     *
     * @return
     *     The decoded string.
     *
     * @throws GuacamoleException
     *     If the provided value is not a valid URL-encoded string.
     */
    private byte[] decode(String value) throws GuacamoleException {

        // Ensure all plus signs are decoded literally rather than as spaces
        // (the Apache HTTPD implementation of URL escaping that applies to
        // request headers does not encode plus signs, whereas the Nginx
        // implementation does)
        value = value.replace("+", "%2B");

        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8.name())
                    .getBytes(StandardCharsets.UTF_8);
        }
        catch (IllegalArgumentException e) {
            throw new GuacamoleClientException("Invalid URL-encoded value.", e);
        }
        catch (UnsupportedEncodingException e) {
            // This should never happen, as UTF-8 is a standard charset that
            // the JVM is required to support
            throw new UnsupportedOperationException("Unexpected lack of UTF-8 support.", e);
        }
    }

    /**
     * Extracts a user's username from the X.509 subject name, which should be
     * in LDAP DN format. If specific username attributes are configured, only
     * those username attributes are used to determine the name. If a specific
     * base DN is configured, only subject names that are formatted as LDAP DNs
     * within that base DN will be accepted.
     *
     * @param name
     *     The subject name to extract the username from.
     *
     * @return
     *     The username of the user represented by the given subject name.
     *
     * @throws GuacamoleException
     *     If any configuration parameters related to retrieving certificates
     *     from HTTP request cannot be parsed, or if the provided subject name
     *     cannot be parsed or is not acceptable (wrong base DN or wrong
     *     username attribute).
     */
    public String getUsername(String name) throws GuacamoleException {

        // Extract user's DN from their X.509 certificate
        LdapName dn;
        try {
            dn = new LdapName(name);
        }
        catch (InvalidNameException e) {
            throw new GuacamoleClientException("Subject \"" + name + "\" is "
                    + "not a valid DN: " + e.getMessage(), e);
        }

        // Verify DN actually contains components
        int numComponents = dn.size();
        if (numComponents < 1)
            throw new GuacamoleClientException("Subject DN is empty.");

        // Verify DN is within configured base DN (if any)
        LdapName baseDN = confService.getSubjectBaseDN();
        if (baseDN != null && !(numComponents > baseDN.size() && dn.startsWith(baseDN)))
            throw new GuacamoleClientException("Subject DN \"" + dn + "\" is "
                    + "not within the configured base DN.");

        // Retrieve the least significant attribute from the parsed DN - this
        // will be the username
        Rdn nameRdn = dn.getRdn(numComponents - 1);

        // Verify that the username is specified with one of the allowed
        // attributes
        Collection<String> usernameAttributes = confService.getSubjectUsernameAttributes();
        if (usernameAttributes != null && !usernameAttributes.stream().anyMatch(nameRdn.getType()::equalsIgnoreCase))
            throw new GuacamoleClientException("Subject DN \"" + dn + "\" "
                    + "does not contain an acceptable username attribute.");

        // The DN is valid - extract the username from the least significant
        // component
        String username = nameRdn.getValue().toString();
        logger.debug("Username \"{}\" extracted from subject DN \"{}\".", username, dn);
        return username;

    }

    /**
     * Authenticates a user using HTTP headers containing that user's verified
     * X.509 certificate. It is assumed that this certificate is being passed
     * to Guacamole from an SSL termination service that has already verified
     * that this certificate is valid and authorized for access to that
     * Guacamole instance.
     *
     * @param certificate
     *     The raw bytes of the X.509 certificate retrieved from the request.
     *
     * @return
     *     The username of the user asserted by the SSL termination service via
     *     that user's X.509 certificate.
     *
     * @throws GuacamoleException
     *     If any configuration parameters related to retrieving certificates
     *     from HTTP request cannot be parsed, or if the certificate is not
     *     valid/present.
     */
    public String getUsername(byte[] certificate) throws GuacamoleException {

        // Parse and re-verify certificate is valid with respect to timestamps
        X509CertificateHolder cert;
        try (Reader reader = new StringReader(new String(certificate, StandardCharsets.UTF_8))) {

            PEMParser parser = new PEMParser(reader);
            Object object = parser.readObject();

            // Verify received data is indeed an X.509 certificate
            if (object == null || !(object instanceof X509CertificateHolder))
                throw new GuacamoleClientException("Certificate did not "
                        + "contain an X.509 certificate.");

            // Verify sanity of received certificate (there should be only
            // one object here)
            if (parser.readObject() != null)
                throw new GuacamoleClientException("Certificate contains "
                        + "more than a single X.509 certificate.");

            cert = (X509CertificateHolder) object;

            // Verify certificate is valid (it should be given pre-validation
            // from SSL termination, but it's worth rechecking for sanity)
            if (!cert.isValidOn(new Date()))
                throw new GuacamoleClientException("Certificate has expired.");

        }
        catch (IOException e) {
            throw new GuacamoleServerException("Certificate could not be read: " + e.getMessage(), e);
        }

        // Extract user's DN from their X.509 certificate in LDAP (RFC 4919) format
        X500Name subject = X500Name.getInstance(RFC4519Style.INSTANCE, cert.getSubject());
        return getUsername(subject.toString());

    }

    /**
     * Processes the X.509 certificate in the given set of HTTP request
     * headers, returning an authentication session token representing the
     * identity in that certificate. If the certificate is invalid or not
     * present, an invalid session token is returned.
     *
     * @param headers
     *     The headers of the HTTP request to process.
     *
     * @return
     *     An authentication session token representing the identity in the
     *     certificate in the given HTTP request, or an invalid session token
     *     if no valid identity was asserted.
     */
    private String processCertificate(HttpHeaders headers) {

        //
        // NOTE: A result with an associated state is ALWAYS returned by
        // processCertificate(), even if the request does not actually contain
        // a valid certificate. This is by design and ensures that the nature
        // of a certificate (valid vs. invalid) cannot be determined except
        // via Guacamole's authentication endpoint, thus allowing auth failure
        // hooks to consider attempts to use invalid certificates as auth
        // failures.
        //

        try {

            // Verify that SSL termination has already verified the certificate
            String verified = getHeader(headers, confService.getClientVerifiedHeader());
            if (verified != null && verified.startsWith(CLIENT_VERIFIED_HEADER_FAILED_PREFIX)) {
                String message = verified.substring(CLIENT_VERIFIED_HEADER_FAILED_PREFIX.length());
                throw new GuacamoleClientException("Client certificate did "
                        + "not pass validation. SSL termination reports the "
                        + "following failure: \"" + message + "\"");
            }
            else if (CLIENT_VERIFIED_HEADER_NONE_VALUE.equals(verified)) {
                throw new GuacamoleClientException("No client certificate was presented.");
            }
            else if (!CLIENT_VERIFIED_HEADER_SUCCESS_VALUE.equals(verified)) {
                throw new GuacamoleClientException("Client certificate did not pass validation.");
            }

            String certificate = getHeader(headers, confService.getClientCertificateHeader());
            if (certificate == null)
                throw new GuacamoleClientException("Client certificate missing from request.");

            String username = getUsername(decode(certificate));
            long validityDuration = TimeUnit.MINUTES.toMillis(confService.getMaxTokenValidity());
            return sessionManager.defer(new SSLAuthenticationSession(username, validityDuration));

        }
        catch (GuacamoleClientException e) {
            logger.warn("SSL/TLS client authentication attempt rejected: {}", e.getMessage());
            logger.debug("SSL/TLS client authentication failed.", e);
        }
        catch (GuacamoleException e) {
            logger.error("SSL/TLS client authentication attempt could not be processed: {}", e.getMessage());
            logger.debug("SSL/TLS client authentication failed.", e);
        }
        catch (RuntimeException | Error e) {
            logger.error("SSL/TLS client authentication attempt failed internally: {}", e.getMessage());
            logger.debug("Internal failure processing SSL/TLS client authentication attempt.", e);
        }

        return sessionManager.generateInvalid();

    }

    /**
     * Attempts to authenticate the current user using SSL/TLS client
     * authentication, returning an opaque value that represents their
     * authenticated status. If necessary, the user is first redirected to a
     * unique endpoint that supports SSL/TLS client authentication.
     *
     * @param headers
     *     All HTTP headers submitted in the user's authentication request.
     *
     * @param host
     *     The hostname that the user specified in their HTTP request.
     *
     * @return
     *     A Response containing an opaque value representing the user's
     *     authenticated status, or a Response redirecting the user to a
     *     unique endpoint that can provide this.
     *
     * @throws GuacamoleException
     *     If any required configuration information is missing or cannot be
     *     parsed, or if the request was not received at a valid subdomain.
     */
    @GET
    @Path("identity")
    public Response authenticateClient(@Context HttpHeaders headers,
            @HeaderParam("Host") String host) throws GuacamoleException {

        // Redirect any requests to the domain that does NOT require SSL/TLS
        // client authentication to the same endpoint at a domain that does
        // require SSL/TLS authentication
        String subdomain = confService.getClientAuthenticationSubdomain(host);
        if (subdomain == null) {

            long validityDuration = TimeUnit.MINUTES.toMillis(confService.getMaxDomainValidity());
            String uniqueSubdomain = subdomainNonceService.generate(validityDuration);

            URI clientAuthURI = UriBuilder.fromUri(confService.getClientAuthenticationURI(uniqueSubdomain))
                    .path("api/ext/ssl/identity")
                    .build();

            return Response.seeOther(clientAuthURI).build();

        }

        //
        // Process certificates only at valid single-use subdomains dedicated
        // to client authentication, redirecting back to the main redirect URI
        // for final authentication if that processing is successful.
        //
        // NOTE: This is CRITICAL. If unique subdomains are not generated and
        // tied to strictly one authentication attempt, then those subdomains
        // could be reused by a user on a shared machine to assume the cached
        // credentials of another user that used that machine earlier. The
        // browser and/or OS may cache the certificate so that it can be reused
        // for future SSL sessions to that same domain. Here, we ensure each
        // generated domain is unique and only valid for certificate processing
        // ONCE. The domain may still be valid with DNS, but will no longer be
        // usable for certificate authentication.
        //

        if (subdomainNonceService.isValid(subdomain))
            return Response.ok(new OpaqueAuthenticationResult(processCertificate(headers)))
                    .header("Access-Control-Allow-Origin", confService.getPrimaryOrigin().toString())
                    .type(MediaType.APPLICATION_JSON)
                    .build();

        throw new GuacamoleResourceNotFoundException("No such resource.");

    }

}
