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

package org.apache.guacamole.properties;

import inet.ipaddr.IPAddress;
import inet.ipaddr.IPAddressString;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * A GuacamoleProperty implementation that parses a String for a comma-separated
 * list of IP addresses and/or IP subnets, both IPv4 and IPv6, and returns the
 * list of those valid IP addresses/subnets.
 */
public abstract class IPAddressListProperty implements GuacamoleProperty<List<IPAddress>> {
    
    /**
     * A pattern which matches against the delimiters between values. This is
     * currently simply a comma and any following whitespace. Parts of the
     * input string which match this pattern will not be included in the parsed
     * result.
     */
    private static final Pattern DELIMITER_PATTERN = Pattern.compile(",\\s*");
    
    @Override
    public List<IPAddress> parseValue(String values) throws GuacamoleException {
        
        // Null for null
        if (values == null)
            return null;
        
        // Not null, just empty
        if (values.isEmpty())
            return Collections.emptyList();
        
        // Split the string into an array
        List<String> addrStrings = Arrays.asList(DELIMITER_PATTERN.split(values));
        List<IPAddress> ipAddresses = new ArrayList<>();
        
        // Loop through each string
        for (String addrString : addrStrings) {
            
            // Convert the string to an IPAddressString for validation
            IPAddressString ipString = new IPAddressString(addrString);
            
            // If this isn't a valid address, subnet, etc., throw an exception
            if (!ipString.isIPAddress())
                throw new GuacamoleServerException("Invalid IP address specified: " + addrString);
            
            // Add the address to the list.
            ipAddresses.add(ipString.getAddress());
        }
        
        // Return our list of valid IP addresses and/or subnets
        return ipAddresses;
        
    }
    
    /**
     * Return true if the provided address list contains the client address,
     * or false if no match is found.
     * 
     * @param addrList
     *     The address list to check for matches.
     * 
     * @param ipAddr
     *     The client address to look for in the list.
     * 
     * @return 
     *     True if the client address is in the provided list, otherwise
     *     false.
     */
    public static boolean addressListContains(List<IPAddress> addrList, IPAddress ipAddr) {
        
        // If either is null, return false
        if (ipAddr == null || addrList == null)
            return false;
        
        for (IPAddress ipEntry : addrList)
                    
            // If version matches and entry contains it, return true
            if (ipEntry.getIPVersion().equals(ipAddr.getIPVersion())
                    && ipEntry.contains(ipAddr))
                return true;
        
        // No match, so return false
        return false;
        
    }
    
}
