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

package org.apache.guacamole.tunnel;

import java.util.List;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;

/**
 * A request object which provides only the functions absolutely required to
 * retrieve and connect to a tunnel.
 */
public abstract class TunnelRequest {

    /**
     * The name of the request parameter containing the user's authentication
     * token.
     */
    public static final String AUTH_TOKEN_PARAMETER = "token";

    /**
     * The name of the parameter containing the identifier of the
     * AuthenticationProvider associated with the UserContext containing the
     * object to which a tunnel is being requested.
     */
    public static final String AUTH_PROVIDER_IDENTIFIER_PARAMETER = "GUAC_DATA_SOURCE";

    /**
     * The name of the parameter specifying the type of object to which a
     * tunnel is being requested. Currently, this may be "c" for a Guacamole
     * connection, or "g" for a Guacamole connection group.
     */
    public static final String TYPE_PARAMETER = "GUAC_TYPE";

    /**
     * The name of the parameter containing the unique identifier of the object
     * to which a tunnel is being requested.
     */
    public static final String IDENTIFIER_PARAMETER = "GUAC_ID";

    /**
     * The name of the parameter containing the desired display width, in
     * pixels.
     */
    public static final String WIDTH_PARAMETER = "GUAC_WIDTH";

    /**
     * The name of the parameter containing the desired display height, in
     * pixels.
     */
    public static final String HEIGHT_PARAMETER = "GUAC_HEIGHT";

    /**
     * The name of the parameter containing the desired display resolution, in
     * DPI.
     */
    public static final String DPI_PARAMETER = "GUAC_DPI";

    /**
     * The name of the parameter specifying one supported audio mimetype. This
     * will normally appear multiple times within a single tunnel request -
     * once for each mimetype.
     */
    public static final String AUDIO_PARAMETER = "GUAC_AUDIO";

    /**
     * The name of the parameter specifying one supported video mimetype. This
     * will normally appear multiple times within a single tunnel request -
     * once for each mimetype.
     */
    public static final String VIDEO_PARAMETER = "GUAC_VIDEO";

    /**
     * The name of the parameter specifying one supported image mimetype. This
     * will normally appear multiple times within a single tunnel request -
     * once for each mimetype.
     */
    public static final String IMAGE_PARAMETER = "GUAC_IMAGE";
    
    /**
     * The name of the parameter specifying the timezone of the client.
     */
    public static final String TIMEZONE_PARAMETER = "GUAC_TIMEZONE";

    /**
     * Returns the value of the parameter having the given name.
     *
     * @param name
     *     The name of the parameter to return.
     *
     * @return
     *     The value of the parameter having the given name, or null if no such
     *     parameter was specified.
     */
    public abstract String getParameter(String name);

    /**
     * Returns a list of all values specified for the given parameter.
     *
     * @param name
     *     The name of the parameter to return.
     *
     * @return
     *     All values of the parameter having the given name , or null if no
     *     such parameter was specified.
     */
    public abstract List<String> getParameterValues(String name);

    /**
     * Returns the value of the parameter having the given name, throwing an
     * exception if the parameter is missing.
     *
     * @param name
     *     The name of the parameter to return.
     *
     * @return
     *     The value of the parameter having the given name.
     *
     * @throws GuacamoleException
     *     If the parameter is not present in the request.
     */
    public String getRequiredParameter(String name) throws GuacamoleException {

        // Pull requested parameter, aborting if absent
        String value = getParameter(name);
        if (value == null)
            throw new GuacamoleClientException("Parameter \"" + name + "\" is required.");

        return value;

    }

    /**
     * Returns the integer value of the parameter having the given name,
     * throwing an exception if the parameter cannot be parsed.
     *
     * @param name
     *     The name of the parameter to return.
     *
     * @return
     *     The integer value of the parameter having the given name, or null if
     *     the parameter is missing.
     *
     * @throws GuacamoleException
     *     If the parameter is not a valid integer.
     */
    public Integer getIntegerParameter(String name) throws GuacamoleException {

        // Pull requested parameter
        String value = getParameter(name);
        if (value == null)
            return null;

        // Attempt to parse as an integer
        try {
            return Integer.parseInt(value);
        }

        // Rethrow any parsing error as a GuacamoleClientException
        catch (NumberFormatException e) {
            throw new GuacamoleClientException("Parameter \"" + name + "\" must be a valid integer.", e);
        }

    }

    /**
     * Returns the authentication token associated with this tunnel request.
     *
     * @return
     *     The authentication token associated with this tunnel request, or
     *     null if no authentication token is present.
     */
    public String getAuthenticationToken() {
        return getParameter(AUTH_TOKEN_PARAMETER);
    }

    /**
     * Returns the identifier of the AuthenticationProvider associated with the
     * UserContext from which the connection or connection group is to be
     * retrieved when the tunnel is created. In the context of the REST API and
     * the JavaScript side of the web application, this is referred to as the
     * data source identifier.
     *
     * @return
     *     The identifier of the AuthenticationProvider associated with the
     *     UserContext from which the connection or connection group is to be
     *     retrieved when the tunnel is created.
     *
     * @throws GuacamoleException
     *     If the identifier was not present in the request.
     */
    public String getAuthenticationProviderIdentifier()
            throws GuacamoleException {
        return getRequiredParameter(AUTH_PROVIDER_IDENTIFIER_PARAMETER);
    }

    /**
     * Returns the type of object for which the tunnel is being requested.
     *
     * @return
     *     The type of object for which the tunnel is being requested.
     *
     * @throws GuacamoleException
     *     If the type was not present in the request, or if the type requested
     *     is in the wrong format.
     */
    public TunnelRequestType getType() throws GuacamoleException {

        TunnelRequestType type = TunnelRequestType.parseType(getRequiredParameter(TYPE_PARAMETER));
        if (type != null)
            return type;

        throw new GuacamoleClientException("Illegal identifier - unknown type.");

    }

    /**
     * Returns the identifier of the destination of the tunnel being requested.
     * As there are multiple types of destination objects available, and within
     * multiple data sources, the associated object type and data source are
     * also necessary to determine what this identifier refers to.
     *
     * @return
     *     The identifier of the destination of the tunnel being requested.
     *
     * @throws GuacamoleException
     *     If the identifier was not present in the request.
     */
    public String getIdentifier() throws GuacamoleException {
        return getRequiredParameter(IDENTIFIER_PARAMETER);
    }

    /**
     * Returns the display width desired for the Guacamole session over the
     * tunnel being requested.
     *
     * @return
     *     The display width desired for the Guacamole session over the tunnel
     *     being requested, or null if no width was given.
     *
     * @throws GuacamoleException
     *     If the width specified was not a valid integer.
     */
    public Integer getWidth() throws GuacamoleException {
        return getIntegerParameter(WIDTH_PARAMETER);
    }

    /**
     * Returns the display height desired for the Guacamole session over the
     * tunnel being requested.
     *
     * @return
     *     The display height desired for the Guacamole session over the tunnel
     *     being requested, or null if no width was given.
     *
     * @throws GuacamoleException
     *     If the height specified was not a valid integer.
     */
    public Integer getHeight() throws GuacamoleException {
        return getIntegerParameter(HEIGHT_PARAMETER);
    }

    /**
     * Returns the display resolution desired for the Guacamole session over
     * the tunnel being requested, in DPI.
     *
     * @return
     *     The display resolution desired for the Guacamole session over the
     *     tunnel being requested, or null if no resolution was given.
     *
     * @throws GuacamoleException
     *     If the resolution specified was not a valid integer.
     */
    public Integer getDPI() throws GuacamoleException {
        return getIntegerParameter(DPI_PARAMETER);
    }

    /**
     * Returns a list of all audio mimetypes declared as supported within the
     * tunnel request.
     *
     * @return
     *     A list of all audio mimetypes declared as supported within the
     *     tunnel request, or null if no mimetypes were specified.
     */
    public List<String> getAudioMimetypes() {
        return getParameterValues(AUDIO_PARAMETER);
    }

    /**
     * Returns a list of all video mimetypes declared as supported within the
     * tunnel request.
     *
     * @return
     *     A list of all video mimetypes declared as supported within the
     *     tunnel request, or null if no mimetypes were specified.
     */
    public List<String> getVideoMimetypes() {
        return getParameterValues(VIDEO_PARAMETER);
    }

    /**
     * Returns a list of all image mimetypes declared as supported within the
     * tunnel request.
     *
     * @return
     *     A list of all image mimetypes declared as supported within the
     *     tunnel request, or null if no mimetypes were specified.
     */
    public List<String> getImageMimetypes() {
        return getParameterValues(IMAGE_PARAMETER);
    }
    
    /**
     * Returns the tz database value of the timezone declared by the client
     * within the tunnel request.
     * 
     * @return 
     *     The tz database value of the timezone parameter as reported by
     *     the client.
     */
    public String getTimezone() {
        return getParameter(TIMEZONE_PARAMETER);
    }
}
