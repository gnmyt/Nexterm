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

package org.apache.guacamole.rest;

import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.ws.rs.core.MultivaluedMap;

/**
 * Wrapper for HttpServletRequest which uses a given MultivaluedMap to provide
 * the values of all request parameters.
 */
public class APIRequest extends HttpServletRequestWrapper {

    /**
     * Map of all request parameter names to their corresponding values.
     */
    private final Map<String, String[]> parameters;

    /**
     * The hostname of the client that initiated the request.
     */
    private final String remoteHost;

    /**
     * The ip address of the client that initiated the request.
     */
    private final String remoteAddr;

    /**
     * Wraps the given HttpServletRequest, using the given MultivaluedMap to
     * provide all request parameters. All HttpServletRequest functions which
     * do not deal with parameter names and values are delegated to the wrapped
     * request.
     *
     * @param request
     *     The HttpServletRequest to wrap.
     *
     * @param parameters
     *     All request parameters.
     */
    public APIRequest(HttpServletRequest request,
            MultivaluedMap<String, String> parameters) {

        super(request);

        // Grab the remote host info
        this.remoteHost = request.getRemoteHost();

        // Grab the remote ip info
        this.remoteAddr = request.getRemoteAddr();

        // Copy parameters from given MultivaluedMap 
        this.parameters = new HashMap<String, String[]>(parameters.size());
        for (Map.Entry<String, List<String>> entry : parameters.entrySet()) {

            // Get parameter name and all corresponding values
            String name = entry.getKey();
            List<String> values = entry.getValue();

            // Add parameters to map
            this.parameters.put(name, values.toArray(new String[values.size()]));
            
        }
        
    }

    @Override
    public String[] getParameterValues(String name) {
        return parameters.get(name);
    }

    @Override
    public Enumeration<String> getParameterNames() {
        return Collections.enumeration(parameters.keySet());
    }

    @Override
    public Map<String, String[]> getParameterMap() {
        return Collections.unmodifiableMap(parameters);
    }

    @Override
    public String getParameter(String name) {

        // If no such parameter exists, just return null
        String[] values = getParameterValues(name);
        if (values == null)
            return null;

        // Otherwise, return first value
        return values[0];

    }

    @Override
    public String getRemoteHost() {
        return this.remoteHost;
    }

    @Override
    public String getRemoteAddr() {
        return this.remoteAddr;
    }

}
