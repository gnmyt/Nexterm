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

package org.apache.guacamole.auth.ldap.conf;

import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * All possible SSL protocols which may be used for secure LDAP connections.
 */
public enum LDAPSSLProtocol {

    /**
     * Use SSLv3 for secure LDAP connection.
     */
    @PropertyValue("SSLv3")
    SSLv3("SSLv3"),
    
    /**
     * Use original TLS for secure LDAP connection.
     */
    @PropertyValue("TLS")
    TLS("TLS"),
    
    /**
     * Use TLSv1 for secure LDAP connection.
     */
    @PropertyValue("TLSv1")
    TLSv1("TLSv1"),
    
    /**
     * Use TLSv1.1 for secure LDAP connection.
     */
    @PropertyValue("TLSv1.1")
    TLSv1_1("TLSv1.1"),
    
    /**
     * Use TLSv1.2 for secure LDAP connection.
     */
    @PropertyValue("TLSv1.2")
    TLSv1_2("TLSv1.2"),
    
    /**
     * Use TLSv1.3 for secure LDAP connection.
     */
    @PropertyValue("TLSv1.3")
    TLSv1_3("TLSv1.3");

    /**
     * The string value of the option to use which is ultimately what the LDAP
     * API consumes to set the SSL protocol.
     */
    public final String STRING_VALUE;

    /**
     * Initializes this SSL protocol such that it is associated with the
     * given string value.
     *
     * @param value
     *     The string value that will be associated with the enum value.
     */
    private LDAPSSLProtocol(String value) {
        this.STRING_VALUE = value;
    }
    
    @Override
    public String toString() {
        return STRING_VALUE;
    }

}
