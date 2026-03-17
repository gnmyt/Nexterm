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

package org.apache.guacamole.protocol;


import java.util.ArrayList;
import java.util.List;

/**
 * An abstract representation of Guacamole client information, including all
 * information required by the Guacamole protocol during the preamble.
 */
public class GuacamoleClientInformation {

    /**
     * The optimal screen width requested by the client, in pixels.
     */
    private int optimalScreenWidth  = 1024;

    /**
     * The optimal screen height requested by the client, in pixels.
     */
    private int optimalScreenHeight = 768;

    /**
     * The resolution of the optimal dimensions given, in DPI.
     */
    private int optimalResolution = 96;

    /**
     * The list of audio mimetypes reported by the client to be supported.
     */
    private final List<String> audioMimetypes = new ArrayList<>();

    /**
     * The list of video mimetypes reported by the client to be supported.
     */
    private final List<String> videoMimetypes = new ArrayList<>();

    /**
     * The list of image mimetypes reported by the client to be supported.
     */
    private final List<String> imageMimetypes = new ArrayList<>();
    
    /**
     * The name of the user reported by the client.
     */
    private String name;
    
    /**
     * The timezone reported by the client.
     */
    private String timezone;

    /**
     * Returns the optimal screen width requested by the client, in pixels.
     * @return The optimal screen width requested by the client, in pixels.
     */
    public int getOptimalScreenWidth() {
        return optimalScreenWidth;
    }

    /**
     * Sets the client's optimal screen width.
     * @param optimalScreenWidth The optimal screen width of the client.
     */
    public void setOptimalScreenWidth(int optimalScreenWidth) {
        this.optimalScreenWidth = optimalScreenWidth;
    }

    /**
     * Returns the optimal screen height requested by the client, in pixels.
     * @return The optimal screen height requested by the client, in pixels.
     */
    public int getOptimalScreenHeight() {
        return optimalScreenHeight;
    }

    /**
     * Sets the client's optimal screen height.
     * @param optimalScreenHeight The optimal screen height of the client.
     */
    public void setOptimalScreenHeight(int optimalScreenHeight) {
        this.optimalScreenHeight = optimalScreenHeight;
    }

    /**
     * Returns the resolution of the screen if the optimal width and height are
     * used, in DPI.
     * 
     * @return The optimal screen resolution.
     */
    public int getOptimalResolution() {
        return optimalResolution;
    }

    /**
     * Sets the resolution of the screen if the optimal width and height are
     * used, in DPI.
     * 
     * @param optimalResolution The optimal screen resolution in DPI.
     */
    public void setOptimalResolution(int optimalResolution) {
        this.optimalResolution = optimalResolution;
    }

    /**
     * Returns the list of audio mimetypes supported by the client. To add or
     * removed supported mimetypes, the list returned by this function can be
     * modified.
     *
     * @return The set of audio mimetypes supported by the client.
     */
    public List<String> getAudioMimetypes() {
        return audioMimetypes;
    }

    /**
     * Returns the list of video mimetypes supported by the client. To add or
     * removed supported mimetypes, the list returned by this function can be
     * modified.
     *
     * @return The set of video mimetypes supported by the client.
     */
    public List<String> getVideoMimetypes() {
        return videoMimetypes;
    }

    /**
     * Returns the list of image mimetypes supported by the client. To add or
     * removed supported mimetypes, the list returned by this function can be
     * modified.
     *
     * @return
     *     The set of image mimetypes supported by the client.
     */
    public List<String> getImageMimetypes() {
        return imageMimetypes;
    }
    
    /**
     * Returns the name of the Guacamole user as reported by the client, or null
     * if the user name is not set.
     * 
     * @return 
     *     A string value of the human-readable name reported by the client.
     */
    public String getName() {
        return name;
    }
    
    /**
     * Return the timezone as reported by the client, or null if the timezone
     * is not set.  Valid timezones are specified in IANA zone key format,
     * also known as Olson time zone database or TZ Database.
     * 
     * @return
     *     A string value of the timezone reported by the client.
     */
    public String getTimezone() {
        return timezone;
    }
    
    /**
     * Set the human-readable name of the user associated with this client.
     * 
     * @param name 
     *     The human-readable name of the user associated with this client.
     */
    public void setName(String name) {
        this.name = name;
    }
    
    /**
     * Set the string value of the timezone, or null if the timezone will not
     * be provided by the client.  Valid timezones are specified in IANA zone
     * key format (aka Olson time zone database or tz database).
     * 
     * @param timezone
     *     The string value of the timezone reported by the client, in tz
     *     database format, or null if the timezone is not provided by the
     *     client.
     */
    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

}
