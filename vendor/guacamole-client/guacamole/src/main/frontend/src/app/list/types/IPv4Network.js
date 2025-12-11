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

/**
 * A service for defining the IPv4Network class.
 */
angular.module('list').factory('IPv4Network', [
    function defineIPv4Network() {

    /**
     * Represents an IPv4 network as a pairing of base address and netmask,
     * both of which are in binary form. To obtain an IPv4Network from
     * standard CIDR or dot-decimal notation, use IPv4Network.parse().
     *
     * @constructor 
     * @param {Number} address
     *     The IPv4 address of the network in binary form.
     *
     * @param {Number} netmask
     *     The IPv4 netmask of the network in binary form.
     */
    var IPv4Network = function IPv4Network(address, netmask) {

        /**
         * Reference to this IPv4Network.
         *
         * @type IPv4Network
         */
        var network = this;

        /**
         * The binary address of this network. This will be a 32-bit quantity.
         *
         * @type Number
         */
        this.address = address;

        /**
         * The binary netmask of this network. This will be a 32-bit quantity.
         *
         * @type Number
         */
        this.netmask = netmask;

        /**
         * Tests whether the given network is entirely within this network,
         * taking into account the base addresses and netmasks of both.
         *
         * @param {IPv4Network} other
         *     The network to test.
         *
         * @returns {Boolean}
         *     true if the other network is entirely within this network, false
         *     otherwise.
         */
        this.contains = function contains(other) {
            return network.address === (other.address & other.netmask & network.netmask);
        };

    };

    /**
     * Parses the given string as an IPv4 address or subnet, returning an
     * IPv4Network object which describes that address or subnet.
     *
     * @param {String} str
     *     The string to parse.
     *
     * @returns {IPv4Network}
     *     The parsed network, or null if the given string is not valid.
     */
    IPv4Network.parse = function parse(str) {

        // Regex which matches the general form of IPv4 addresses
        var pattern = /^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})(?:\/([0-9]{1,2}))?$/;

        // Parse IPv4 address via regex
        var match = pattern.exec(str);
        if (!match)
            return null;

        // Parse netmask, if given
        var netmask = 0xFFFFFFFF;
        if (match[5]) {
            var bits = parseInt(match[5]);
            if (bits > 0 && bits <= 32)
                netmask = 0xFFFFFFFF << (32 - bits);
        }

        // Read each octet onto address
        var address = 0;
        for (var i=1; i <= 4; i++) {

            // Validate octet range
            var octet = parseInt(match[i]);
            if (octet > 255)
                return null;

            // Shift on octet
            address = (address << 8) | octet;

        }

        return new IPv4Network(address, netmask);

    };

    return IPv4Network;

}]);
