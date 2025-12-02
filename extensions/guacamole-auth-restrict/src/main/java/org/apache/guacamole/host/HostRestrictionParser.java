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

package org.apache.guacamole.host;

import inet.ipaddr.HostName;
import inet.ipaddr.HostNameException;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A utility class that parses a string for a set of IPv4 or IPv6 addresses,
 * or hostnames, splitting the string into a list of components.
 */
public class HostRestrictionParser {
    
    /**
     * The logger for this class.
     */
    private static final Logger LOGGER = LoggerFactory.getLogger(HostRestrictionParser.class);
    
    /**
     * Parse the provided string into a List of HostName objects, validating
     * that each item is an IP address, subnet, and/or DNS name.
     * 
     * @param hostString
     *     The string that contains a semi-colon-separated list of items to
     *     parse.
     * 
     * @return
     *     A List of HostName objects parsed from the provided string.
     */
    public static List<HostName> parseHostList(String hostString) {
        
        List<HostName> addressList = new ArrayList<>();
        
        if (hostString == null || hostString.isEmpty())
            return addressList;
        
        // First split the string by semicolons and process each entry
        for (String host : hostString.split(";")) {
            
            HostName hostName = new HostName(host);
            try {
                hostName.validate();
                addressList.add(hostName);
            }
            catch (HostNameException e) {
                LOGGER.warn("Invalid host name or IP: {}", host);
                LOGGER.debug("HostNameException.", e.getMessage());
            }
            
        }
        
        return addressList;
        
    }
    
}
