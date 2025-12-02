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

package org.apache.guacamole.net;

import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

/**
 * A copy of the details of an HTTP request. The values within this object can
 * be accessed even when outside the scope of the specific request represented.
 */
public class RequestDetails {

    /**
     * The address of the client that sent the associated request.
     */
    private final String remoteAddress;

    /**
     * The hostname or, if the hostname cannot be determined, the address of the
     * client that sent the associated request.
     */
    private final String remoteHostname;

    /**
     * The HttpSession associated with the request, if any.
     */
    private final HttpSession session;

    /**
     * An unmodifiable Map of all HTTP headers included in the associated
     * request. If there are no such headers, this Map will be empty. As there
     * may be many values for each header, each value is stored as a separate
     * entry in an unmodifiable List. The keys of this map (header names) are
     * case-insensitive.
     */
    private final Map<String, List<String>> headers;

    /**
     * An unmodifiable Map of all HTTP parameters included in the associated
     * request. If there are no such parameters, this Map will be empty. As
     * there may be many values for each parameter, each value is stored as a
     * separate entry in an unmodifiable List. Unlike headers, the keys of this
     * map (parameter names) are case-sensitive.
     */
    private final Map<String, List<String>> parameters;

    /**
     * An unmodifiable list of all cookies associated with the request. If
     * there are no cookies associated with the request, this List will be
     * empty.
     */
    private final List<Cookie> cookies;

    /**
     * Returns an unmodifiable Map of all HTTP headers within the given request.
     * If there are no such headers, the returned Map will be empty. As there
     * may be many values for each header, each value is stored as a separate
     * entry in an unmodifiable List. The keys of the returned map (header
     * names) are case-insensitive.
     *
     * @param request
     *     The HTTP request to extract all headers from.
     *
     * @return
     *     An unmodifiable Map of all HTTP headers in the given request.
     */
    private static Map<String, List<String>> getHeaders(HttpServletRequest request) {

        @SuppressWarnings("unchecked") // getHeaderNames() is explicitly documented as returning a Enumeration<String>
        Enumeration<String> names = (Enumeration<String>) request.getHeaderNames();

        // Represent the total lack of headers as an empty map, not null
        if (names == null)
            return Collections.emptyMap();

        // Headers are case-insensitive
        Map<String, List<String>> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        while (names.hasMoreElements()) {

            String name = names.nextElement();

            @SuppressWarnings("unchecked") // getHeaders() is explicitly documented as returning a Enumeration<String>
            Enumeration<String> values = (Enumeration<String>) request.getHeaders(name);
            if (values != null && values.hasMoreElements())
                headers.put(name, Collections.unmodifiableList(Collections.list(values)));

        }

        return Collections.unmodifiableMap(headers);

    }

    /**
     * Returns an unmodifiable Map of all HTTP parameters within the given
     * request. If there are no such parameters, the returned Map will be empty.
     * As there may be many values for each parameter, each value is stored as a
     * separate entry in an unmodifiable List. Unlike headers, the keys of the
     * returned map (parameter names) are case-sensitive.
     *
     * @param request
     *     The HTTP request to extract all parameters from.
     *
     * @return
     *     An unmodifiable Map of all HTTP parameters in the given request.
     */
    private static Map<String, List<String>> getParameters(HttpServletRequest request) {

        @SuppressWarnings("unchecked") // getParameterNames() is explicitly documented as returning a Enumeration<String>
        Enumeration<String> names = (Enumeration<String>) request.getParameterNames();

        // Represent the total lack of parameters as an empty map, not null
        if (names == null)
            return Collections.emptyMap();

        // Unlike headers, parameters are case-sensitive
        Map<String, List<String>> parameters = new HashMap<>();
        while (names.hasMoreElements()) {

            String name = names.nextElement();

            String[] values = request.getParameterValues(name);
            if (values != null && values.length != 0)
                parameters.put(name, Collections.unmodifiableList(Arrays.asList(values)));

        }

        return Collections.unmodifiableMap(parameters);

    }

    /**
     * Returns an unmodifiable List of all cookies in the given HTTP request.
     *
     * @param request
     *     The HTTP request to extract all cookies from.
     *
     * @return
     *     An unmodifiable List of all cookies in the given request.
     */
    private static List<Cookie> getCookies(HttpServletRequest request) {

        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookies.length == 0)
            return Collections.emptyList();

        return Collections.unmodifiableList(Arrays.asList(cookies));

    }

    /**
     * Creates a new RequestDetails that copies the details of the given HTTP
     * request. The provided request may safely go out of scope and be reused
     * for future requests without rendering the content of this RequestDetails
     * invalid or inaccessible.
     * <p>
     * Though an HttpSession will be retrieved from the given request if the
     * HttpSession already exists on the request, no HttpSession will be created
     * through invoking this constructor.
     *
     * @param request
     *     The HTTP request to copy the details of.
     */
    public RequestDetails(HttpServletRequest request) {
        this.cookies = getCookies(request);
        this.headers = getHeaders(request);
        this.parameters = getParameters(request);
        this.remoteAddress = request.getRemoteAddr();
        this.remoteHostname = request.getRemoteHost();
        this.session = request.getSession(false);
    }

    /**
     * Creates a new RequestDetails that copies the details of the given
     * RequestDetails.
     *
     * @param requestDetails
     *     The RequestDetails to copy.
     */
    public RequestDetails(RequestDetails requestDetails) {
        this.cookies = requestDetails.getCookies();
        this.headers = requestDetails.getHeaders();
        this.parameters = requestDetails.getParameters();
        this.remoteAddress = requestDetails.getRemoteAddress();
        this.remoteHostname = requestDetails.getRemoteHostname();
        this.session = requestDetails.getSession();
    }

    /**
     * Returns the first value stored for the given key in the given Map. If no
     * such key exists in the map, or no values are associated with the given
     * key, null is returned.
     *
     * @param map
     *     A Map of keys to multiple values, where each set of multiple values
     *     is represented by a List.
     *
     * @param key
     *     The key to look up.
     *
     * @return
     *     The first value stored for the given key in the given Map, or null
     *     if there is no such value or no such key.
     */
    private static String getFirstValue(Map<String, List<String>> map, String key) {

        List<String> values = map.get(key);
        if (values == null || values.isEmpty())
            return null;

        return values.get(0);

    }

    /**
     * Returns the value of the HTTP header having the given name. Header names
     * are case-insensitive. If no such header was present, null is returned. If
     * the header had multiple values, the first value is returned.
     *
     * @param name
     *     The name of the header to retrieve. This name is case-insensitive.
     *
     * @return
     *     The first value of the HTTP header with the given name, or null if
     *     there is no such header.
     */
    public String getHeader(String name) {
        return getFirstValue(headers, name);
    }

    /**
     * Returns an unmodifiable List of all values of the HTTP header having the
     * given name. Header names are case-insensitive. If no such header was
     * present, the returned List will be empty.
     *
     * @param name
     *     The name of the header to retrieve. This name is case-insensitive.
     *
     * @return
     *     An unmodifiable List of all values of the HTTP header with the
     *     given name, or an empty List if there is no such header.
     */
    public List<String> getHeaders(String name) {
        return headers.getOrDefault(name, Collections.emptyList());
    }

    /**
     * Returns an unmodifiable Set of the names of all HTTP headers present on
     * the request. If there are no headers, this set will be empty. Header
     * names are case-insensitive, and the returned Set will perform lookups in
     * a case-insensitive manner.
     *
     * @return
     *     An unmodifiable Set of the names of all HTTP headers present on the
     *     request.
     */
    public Set<String> getHeaderNames() {
        return headers.keySet();
    }

    /**
     * Returns an unmodifiable Map of all values of all HTTP headers on the
     * request, where each Map key is a header name. Each Map value is an
     * unmodifiable List of all values provided for the associated header and
     * will contain at least one value. Header names are case-insensitive, and
     * the returned map will perform lookups in a case-insensitive manner.
     *
     * @return
     *     An unmodifiable Map of all values of all HTTP headers on the
     *     request.
     */
    public Map<String, List<String>> getHeaders() {
        return headers;
    }

    /**
     * Returns the value of the HTTP parameter having the given name. Parameter
     * names are case-sensitive. If no such parameter was present, null is
     * returned. If the parameter had multiple values, the first value is
     * returned.
     *
     * @param name
     *     The name of the parameter to retrieve. This name is case-sensitive.
     *
     * @return
     *     The first value of the HTTP parameter with the given name, or null
     *     if there is no such parameter.
     */
    public String getParameter(String name) {
        return getFirstValue(parameters, name);
    }

    /**
     * Returns an unmodifiable List of all values of the HTTP parameter having
     * the given name. Parameter names are case-sensitive. If no such parameter
     * was present, the returned List will be empty.
     *
     * @param name
     *     The name of the parameter to retrieve. This name is case-sensitive.
     *
     * @return
     *     An unmodifiable List of all values of the HTTP parameter with the
     *     given name, or an empty List if there is no such parameter.
     */
    public List<String> getParameters(String name) {
        return parameters.getOrDefault(name, Collections.emptyList());
    }

    /**
     * Returns an unmodifiable Set of the names of all HTTP parameters present
     * on the request. If there are no parameters, this set will be empty.
     * Parameter names are case-sensitive, and the returned Set will perform
     * lookups in a case-sensitive manner.
     *
     * @return
     *     An unmodifiable Set of the names of all HTTP parameters present on
     *     the request.
     */
    public Set<String> getParameterNames() {
        return parameters.keySet();
    }

    /**
     * Returns an unmodifiable Map of all values of all HTTP parameters on the
     * request, where each Map key is a parameter name. Each Map value is an
     * unmodifiable List of all values provided for the associated parameter and
     * will contain at least one value. Parameter names are case-sensitive, and
     * the returned map will perform lookups in a case-sensitive manner.
     *
     * @return
     *     An unmodifiable Map of all values of all HTTP parameters on the
     *     request.
     */
    public Map<String, List<String>> getParameters() {
        return parameters;
    }

    /**
     * Returns an unmodifiable List of all cookies in the request. If no cookies
     * are present, the returned List will be empty.
     *
     * @return
     *     An unmodifiable List of all cookies in the request, which may an
     *     empty List.
     */
    public List<Cookie> getCookies() {
        return cookies;
    }

    /**
     * Returns the HttpSession associated with the request, if any.
     * <p>
     * <strong>NOTE: Guacamole itself does not use the HttpSession.</strong>
     * The extension subsystem does not provide access to the session object
     * used by Guacamole, which is considered internal. Access to an HttpSession
     * is only of use if you have another application in place that
     * <em>does</em> use HttpSession and needs to be considered.
     *
     * @return
     *     The HttpSession associated with the request, or null if there is
     *     no HttpSession.
     */
    public HttpSession getSession() {
        return session;
    }

    /**
     * Returns the address of the client that sent the associated request.
     *
     * @return
     *     The address of the client that sent the request.
     */
    public String getRemoteAddress() {
        return remoteAddress;
    }

    /**
     * Returns the hostname of the client that sent the associated request, if
     * known. If the hostname of the client cannot be determined, the address
     * will be returned instead.
     *
     * @return
     *     The hostname or address of the client that sent the request.
     */
    public String getRemoteHostname() {
        return remoteHostname;
    }

}
