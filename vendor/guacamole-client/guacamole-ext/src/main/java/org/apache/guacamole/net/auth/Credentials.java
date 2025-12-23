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

package org.apache.guacamole.net.auth;

import org.apache.guacamole.net.RequestDetails;
import java.io.Serializable;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

/**
 * Simple arbitrary set of credentials, including a username/password pair and
 * a copy of the details of the HTTP request received for authentication.
 * <p>
 * This class is used along with AuthenticationProvider to provide arbitrary
 * HTTP-based authentication for Guacamole.
 */
public class Credentials implements Serializable {

    /**
     * Unique identifier associated with this specific version of Credentials.
     */
    private static final long serialVersionUID = 1L;

    /**
     * An arbitrary username.
     */
    private String username;

    /**
     * An arbitrary password.
     */
    private String password;

    /**
     * The details of the HTTP request that provided these Credentials.
     */
    private transient RequestDetails requestDetails;

    /**
     * The HttpServletRequest carrying additional credentials, if any.
     */
    private transient HttpServletRequest request;

    /**
     * Creates a new Credentials object with the given username, password,
     * and HTTP request. The details of the request are copied for later
     * reference and can be retrieved with {@link #getRequestDetails()}.
     *
     * @param username
     *     The username that was provided for authentication.
     *
     * @param password
     *     The password that was provided for authentication.
     *
     * @param request
     *     The HTTP request associated with the authentication
     *     request.
     */
    public Credentials(String username, String password, HttpServletRequest request) {
        this(username, password, new RequestDetails(request));
        this.request = request;
    }

    /**
     * Creates a new Credentials object with the given username, password,
     * and general HTTP request details.
     *
     * @param username
     *     The username that was provided for authentication.
     *
     * @param password
     *     The password that was provided for authentication.
     *
     * @param requestDetails
     *     The details of the HTTP request associated with the authentication
     *     request.
     */
    public Credentials(String username, String password, RequestDetails requestDetails) {
        this.username = username;
        this.password = password;
        this.requestDetails = requestDetails;
    }

    /**
     * Returns the password associated with this set of credentials.
     *
     * @return
     *     The password associated with this username/password pair, or null
     *     if no password has been set.
     */
    public String getPassword() {
        return password;
    }

    /**
     * Sets the password associated with this set of credentials.
     *
     * @param password
     *     The password to associate with this username/password pair.
     */
    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * Returns the username associated with this set of credentials.
     *
     * @return
     *     The username associated with this username/password pair, or null
     *     if no username has been set.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the username associated with this set of credentials.
     *
     * @param username
     *     The username to associate with this username/password pair.
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the HttpServletRequest associated with this set of credentials.
     *
     * @deprecated
     *     It is not reliable to reference an HttpServletRequest outside the
     *     scope of the specific request that created it. Use
     *     {@link #getRequestDetails()} instead.
     *
     * @return
     *     The HttpServletRequest associated with this set of credentials,
     *     or null if no such request exists.
     */
    @Deprecated
    public HttpServletRequest getRequest() {
        return request;
    }

    /**
     * Sets the HttpServletRequest associated with this set of credentials.
     *
     * @deprecated
     *     It is not reliable to reference an HttpServletRequest outside the
     *     scope of the specific request that created it. Use
     *     {@link #setRequestDetails(org.apache.guacamole.net.RequestDetails)}
     *     instead.
     *
     * @param request
     *     The HttpServletRequest to associated with this set of credentials.
     */
    @Deprecated
    public void setRequest(HttpServletRequest request) {
        setRequestDetails(new RequestDetails(request));
        this.request = request;
    }

    /**
     * Returns the details of the HTTP request related to these Credentials.
     *
     * @return
     *     The details of the HTTP request related to these Credentials.
     */
    public RequestDetails getRequestDetails() {
        return requestDetails;
    }

    /**
     * Replaces the current HTTP request details of these Credentials with the
     * given details.
     *
     * @param requestDetails
     *     The details of the HTTP request that should replace the established
     *     details within these Credentials.
     */
    public void setRequestDetails(RequestDetails requestDetails) {
        this.requestDetails = requestDetails;
    }

    /**
     * Returns the HttpSession associated with this set of credentials.
     * <p>
     * This is a convenience function that is equivalent to invoking
     * {@link RequestDetails#getSession()} on the {@link RequestDetails}
     * returned by {@link #getRequestDetails()}.
     * <p>
     * <strong>NOTE: Guacamole itself does not use the HttpSession.</strong>
     * The extension subsystem does not provide access to the session object
     * used by Guacamole, which is considered internal. Access to an HttpSession
     * is only of use if you have another application in place that
     * <em>does</em> use HttpSession and needs to be considered.
     *
     * @return
     *     The HttpSession associated with this set of credentials, or null if
     *     there is no HttpSession.
     */
    public HttpSession getSession() {
        return requestDetails.getSession();
    }

    /**
     * Sets the HttpSession associated with this set of credentials.
     *
     * @deprecated
     *     Since 1.6.0, the HttpSession that may be associated with a
     *     Credentials object is tied to the RequestDetails. If the HttpSession
     *     is part of a Credentials and truly needs to be replaced by another
     *     HttpSession, use {@link #setRequestDetails(org.apache.guacamole.net.RequestDetails)}
     *     to override the underlying {@link RequestDetails} instead.
     *
     * @param session
     *     The HttpSession to associated with this set of credentials.
     */
    @Deprecated
    public void setSession(HttpSession session) {
        setRequestDetails(new RequestDetails(getRequestDetails()) {

            @Override
            public HttpSession getSession() {
                return session;
            }

        });
    }

    /**
     * Returns the value of the HTTP header having the given name from the
     * original details of the HTTP request that is related to these
     * credentials. Header names are case-insensitive. If no such header was
     * present, null is returned. If the header had multiple values, the first
     * value is returned.
     * <p>
     * For access to all values of a header, as well as other details of the
     * request, see {@link #getRequestDetails()}. This is a convenience
     * function that is equivalent to invoking {@link RequestDetails#getHeader(java.lang.String)}.
     *
     * @param name
     *     The name of the header to retrieve. This name is case-insensitive.
     *
     * @return
     *     The first value of the HTTP header with the given name, or null if
     *     there is no such header.
     */
    public String getHeader(String name) {
        return getRequestDetails().getHeader(name);
    }

    /**
     * Returns the value of the HTTP parameter having the given name from the
     * original details of the HTTP request that is related to these
     * credentials. Parameter names are case-sensitive. If no such parameter was
     * present, null is returned. If the parameter had multiple values, the
     * first value is returned.
     * <p>
     * For access to all values of a parameter, as well as other details of the
     * request, see {@link #getRequestDetails()}. This is a convenience
     * function that is equivalent to invoking {@link RequestDetails#getParameter(java.lang.String)}.
     *
     * @param name
     *     The name of the parameter to retrieve. This name is case-sensitive.
     *
     * @return
     *     The first value of the HTTP parameter with the given name, or null
     *     if there is no such parameter.
     */
    public String getParameter(String name) {
        return getRequestDetails().getParameter(name);
    }

    /**
     * Returns the address of the client end of the connection which provided
     * these credentials, if known.
     * <p>
     * This is a convenience function that is equivalent to invoking
     * {@link RequestDetails#getRemoteAddress()} on the
     * {@link RequestDetails} returned by {@link #getRequestDetails()}.
     *
     * @return
     *     The address of the client end of the connection which provided these
     *     credentials, or null if the address is not known.
     */
    public String getRemoteAddress() {
        return getRequestDetails().getRemoteAddress();
    }

    /**
     * Sets the address of the client end of the connection which provided
     * these credentials.
     *
     * @deprecated
     *     Since 1.6.0, the address that may be associated with a Credentials
     *     object is tied to the RequestDetails. If the address truly needs to
     *     be replaced, use {@link #setRequestDetails(org.apache.guacamole.net.RequestDetails)}
     *     to override the underlying {@link RequestDetails} instead.
     *
     * @param remoteAddress
     *     The address of the client end of the connection which provided these
     *     credentials, or null if the address is not known.
     */
    @Deprecated
    public void setRemoteAddress(String remoteAddress) {
        setRequestDetails(new RequestDetails(getRequestDetails()) {

            @Override
            public String getRemoteAddress() {
                return remoteAddress;
            }

        });
    }

    /**
     * Returns the hostname of the client end of the connection which provided
     * these credentials, if known. If the hostname of the client cannot be
     * determined, but the address is known, the address may be returned
     * instead.
     * <p>
     * This is a convenience function that is equivalent to invoking
     * {@link RequestDetails#getRemoteHostname()} on the
     * {@link RequestDetails} returned by {@link #getRequestDetails()}.
     *
     * @return
     *     The hostname or address of the client end of the connection which
     *     provided these credentials, or null if the hostname is not known.
     */
    public String getRemoteHostname() {
        return getRequestDetails().getRemoteHostname();
    }

    /**
     * Sets the hostname of the client end of the connection which provided
     * these credentials, if known. If the hostname of the client cannot be
     * determined, but the address is known, the address may be specified
     * instead.
     *
     * @deprecated
     *     Since 1.6.0, the hostname that may be associated with a Credentials
     *     object is tied to the RequestDetails. If the hostname truly needs to
     *     be replaced, use {@link #setRequestDetails(org.apache.guacamole.net.RequestDetails)}
     *     to override the underlying {@link RequestDetails} instead.
     *
     * @param remoteHostname
     *     The hostname or address of the client end of the connection which
     *     provided these credentials, or null if the hostname is not known.
     */
    @Deprecated
    public void setRemoteHostname(String remoteHostname) {
        setRequestDetails(new RequestDetails(getRequestDetails()) {

            @Override
            public String getRemoteHostname() {
                return remoteHostname;
            }

        });
    }

    /**
     * Returns whether this Credentials object does not contain any specific
     * authentication parameters, including HTTP parameters and the HTTP header
     * used for the authentication token. An authentication request that
     * contains no parameters whatsoever will tend to be the first, anonymous,
     * credential-less authentication attempt that results in the initial login
     * screen rendering.
     *
     * @return
     *     true if this Credentials object contains no authentication
     *     parameters whatsoever, false otherwise.
     */
    public boolean isEmpty() {

        // An authentication request that contains an explicit username or
        // password (even if blank) is non-empty, regardless of how the values
        // were passed
        if (getUsername() != null || getPassword() != null)
            return false;

        // An authentication request is non-empty if it contains any HTTP
        // parameters at all or contains an authentication token
        return getRequestDetails().getParameterNames().isEmpty() && getHeader("Guacamole-Token") == null;

    }

}
