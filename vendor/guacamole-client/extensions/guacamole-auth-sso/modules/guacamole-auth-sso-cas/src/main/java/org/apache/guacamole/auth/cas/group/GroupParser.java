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

package org.apache.guacamole.auth.cas.group;

/**
 * Parser which converts the group names returned by CAS into names usable by
 * Guacamole. The format of a CAS group name may vary by the underlying
 * authentication backend. For example, a CAS deployment backed by LDAP may
 * provide group names as LDAP DNs, which must be transformed into normal group
 * names to be usable within Guacamole.
 *
 * @see LDAPGroupParser
 */
public interface GroupParser {

    /**
     * Parses the given CAS group name into a group name usable by Guacamole.
     *
     * @param casGroup
     *     The group name retrieved from CAS.
     *
     * @return
     *     A group name usable by Guacamole, or null if the group is not valid.
     */
    String parse(String casGroup);

}
