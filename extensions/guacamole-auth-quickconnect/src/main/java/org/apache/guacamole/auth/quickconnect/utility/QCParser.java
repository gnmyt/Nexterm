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

import java.io.UnsupportedEncodingException;
import java.lang.StringBuilder;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * A utility class to parse out a URI into the settings necessary
 * to generate a GuacamoleConfiguration object.
 */
public class QCParser {

    /**
     * The regex to use to split username and password.
     */
    private static final Pattern userinfoPattern = Pattern.compile("(^[^:]+):?(.*)");

    /**
     * The regex group of the username.
     */
    private static final int USERNAME_GROUP = 1;

    /**
     * THe regex group of the password.
     */
    private static final int PASSWORD_GROUP = 2;
    
    /**
     * The list of parameters that are allowed to be placed into a configuration
     * by this parser. If not defined, all parameters will be allowed unless
     * explicitly denied.
     */
    private final Collection<String> allowedParams;
    
    /**
     * The list of parameters that are explicitly denied from being placed into
     * a configuration by this parser.
     */
    private final Collection<String> deniedParams;
    
    /**
     * Create a new instance of the QCParser class, with the provided allowed
     * and denied parameter lists, if any.
     * 
     * @param allowedParams
     *     A list of parameters that are allowed to be parsed and placed into
     *     a connection configuration, or null or empty if all parameters are
     *     allowed.
     * 
     * @param deniedParams 
     *     A list of parameters, if any, that should be explicitly denied from
     *     being placed into a connection configuration.
     */
    public QCParser(Collection<String> allowedParams, Collection<String> deniedParams) {
        this.allowedParams = allowedParams;
        this.deniedParams = deniedParams;
    }
    
    /**
     * Create a new instance of the QCParser class, initializing the allowed
     * and denied parameter lists to empty lists, which means all parameters
     * will be allowed and none will be denied.
     */
    public QCParser() {
        this.allowedParams = Collections.emptyList();
        this.deniedParams = Collections.emptyList();
    }
    
    /**
     * Parse out a URI string and get a GuacamoleConfiguration
     * from that string, or an exception if the parsing fails.
     *
     * @param uri
     *     The string form of the URI to be parsed.
     *
     * @return
     *     A GuacamoleConfiguration generated using the information
     *     provided by the user in the URI.
     *
     * @throws GuacamoleException
     *     If an error occurs parsing the URI.
     */
    public GuacamoleConfiguration getConfiguration(String uri)
            throws GuacamoleException {

        // Parse the provided String into a URI object.
        URI qcUri;
        try {
            qcUri = new URI(uri);
            if (!qcUri.isAbsolute())
                throw new TranslatableGuacamoleClientException("URI must be absolute.",
                        "QUICKCONNECT.ERROR_NOT_ABSOLUTE_URI");
        }
        catch (URISyntaxException e) {
            throw new TranslatableGuacamoleClientException("Invalid URI Syntax",
                    "QUICKCONNECT.ERROR_INVALID_URI");
        }

        // Break out individual components of the URI.
        String protocol = qcUri.getScheme();
        String host = qcUri.getHost();
        int port = qcUri.getPort();
        String userInfo = qcUri.getUserInfo();
        String query = qcUri.getQuery();

        // Generate a new GuacamoleConfiguration
        GuacamoleConfiguration qcConfig = new GuacamoleConfiguration();

        // Check for protocol and set it, or throw an error if not present
        if (protocol != null && !protocol.isEmpty())
            qcConfig.setProtocol(protocol);
        else
            throw new TranslatableGuacamoleClientException("No protocol specified.",
                    "QUICKCONNECT.ERROR_NO_PROTOCOL");

        // Check for provided port number
        if (port > 0 && paramIsAllowed("port"))
            qcConfig.setParameter("port", Integer.toString(port));

        // Check for provided host, or throw an error if not present
        if (host != null && !host.isEmpty() && paramIsAllowed("hostname"))
            qcConfig.setParameter("hostname", host);
        else
            throw new TranslatableGuacamoleClientException("No host specified.",
                    "QUICKCONNECT.ERROR_NO_HOST");

        // Look for extra query parameters and parse them out.
        if (query != null && !query.isEmpty())
            parseQueryString(query, qcConfig);

        // Look for the username and password and parse them out.
        if (userInfo != null && !userInfo.isEmpty())
                parseUserInfo(userInfo, qcConfig);

        return qcConfig;
        
    }

    /**
     * Parse the given string for parameter key/value pairs and update the
     * provided GuacamoleConfiguration object with the parsed values, checking
     * to make sure that the parser is allowed to provide the requested
     * parameters.
     *
     * @param queryStr
     *     The query string to parse for key/value pairs.
     *
     * @param config
     *     The GuacamoleConfiguration object that should be updated with the
     *     parsed parameters.
     *
     * @throws GuacamoleException
     *     If Java unexpectedly lacks UTF-8 support.
     */
    private void parseQueryString(String queryStr, GuacamoleConfiguration config)
            throws GuacamoleException {

        // Split the query string into the pairs
        List<String> paramList = Arrays.asList(queryStr.split("&"));

        // Loop through key/value pairs and put them in the Map.
        for (String param : paramList) {
            String[] paramArray = param.split("=", 2);
            try {
                String paramName = URLDecoder.decode(paramArray[0], "UTF-8");
                String paramValue = URLDecoder.decode(paramArray[1], "UTF-8");
                if (paramIsAllowed(paramName))
                    config.setParameter(paramName, paramValue);
            }
            catch (UnsupportedEncodingException e) {
                throw new GuacamoleServerException("Unexpected lack of UTF-8 encoding support.", e);
            }
        }
    }

    /**
     * Parse the given string for username and password values, and, if values
     * are present and allowed by the configuration, decode them and set them in
     * the provided GuacamoleConfiguration object.
     *
     * @param userInfo
     *     The string to parse for username/password values.
     *
     * @param config
     *     The GuacamoleConfiguration object to store the username
     *     and password in.
     *
     * @throws GuacamoleException
     *     If Java unexpectedly lacks UTF-8 support.
     */
    private void parseUserInfo(String userInfo, 
            GuacamoleConfiguration config)
            throws GuacamoleException {

        Matcher userinfoMatcher = userinfoPattern.matcher(userInfo);

        if (userinfoMatcher.matches()) {
            String username = userinfoMatcher.group(USERNAME_GROUP);
            String password = userinfoMatcher.group(PASSWORD_GROUP);

            if (username != null && !username.isEmpty() && paramIsAllowed("username")) {
                try {
                    config.setParameter("username",
                            URLDecoder.decode(username, "UTF-8"));
                }
                catch (UnsupportedEncodingException e) {
                    throw new GuacamoleServerException("Unexpected lack of UTF-8 encoding support.", e);
                }
            }

            if (password != null && !password.isEmpty() && paramIsAllowed("password")) {
                try {
                    config.setParameter("password",
                            URLDecoder.decode(password, "UTF-8"));
                }
                catch (UnsupportedEncodingException e) {
                    throw new GuacamoleServerException("Unexpected lack of UTF-8 encoding support.", e);
                }
            }
        }

    }

    /**
     * Given a GuacamoleConfiguration object, generate a name
     * for the configuration based on the protocol, host, user
     * and port in the configuration, and return the string value.
     *
     * @param config
     *     The GuacamoleConfiguration object to use to generate
     *     the name.
     *
     * @return
     *     The String value of the name that is generated.
     *
     * @throws GuacamoleException
     *     If an error occurs getting items in the configuration.
     */
    public String getName(GuacamoleConfiguration config)
            throws GuacamoleException {

        if (config == null)
            return null;

        String protocol = config.getProtocol();
        String host = config.getParameter("hostname");
        String port = config.getParameter("port");
        String user = config.getParameter("username");

        StringBuilder name = new StringBuilder();

        if (protocol != null && !protocol.isEmpty())
            name.append(protocol).append("://");

        if (user != null && !user.isEmpty())
            name.append(user).append("@");

        if (host != null && !host.isEmpty())
            name.append(host);

        if (port != null && !port.isEmpty())
            name.append(":").append(port);

        name.append("/");

        return name.toString();
    }
    
    /**
     * For a given parameter, check to make sure the parameter is allowed to be
     * used in the connection configuration, first by checking to see if
     * allowed parameters are defined and the given parameter is present, then
     * by checking for explicitly denied parameters. Returns false if the
     * configuration prevents the parameter from being used, otherwise true.
     * 
     * @param param
     *     The name of the parameter to check.
     * 
     * @return 
     *     False if the configuration prevents the parameter from being used,
     *     otherwise true.
     */
    private boolean paramIsAllowed(String param) {
        
        // If allowed parameters are defined and not empty,
        // check to see if this parameter is allowed.
        if (allowedParams != null && !allowedParams.isEmpty() && !allowedParams.contains(param))
            return false;
        
        // If denied parameters are defined and not empty,
        // check to see if this parameter is denied.
        if (deniedParams != null && !deniedParams.isEmpty() && deniedParams.contains(param))
            return false;
        
        // By default, the parameter is allowed.
        return true;
        
    }

}
