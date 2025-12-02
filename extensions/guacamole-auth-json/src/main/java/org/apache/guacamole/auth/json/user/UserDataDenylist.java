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

package org.apache.guacamole.auth.json.user;

import com.google.common.io.BaseEncoding;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Atomic denylist of UserData objects, stored by their associated
 * cryptographic signatures. UserData objects stored within this denylist MUST
 * have an associated expiration timestamp, and will automatically be removed
 * from the denylist once they have expired.
 */
public class UserDataDenylist {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserDataDenylist.class);

    /**
     * All denylisted UserData objects, stored by their associated
     * cryptographic signatures. NOTE: Each key into this map is the hex
     * string produced by encoding the binary signature using DatatypeConverter.
     * A byte[] cannot be used directly.
     */
    private final ConcurrentMap<String, UserData> denylist = new ConcurrentHashMap<>();

    /**
     * Removes all expired UserData objects from the denylist. This will
     * automatically be invoked whenever new UserData is added to the denylist.
     */
    public void removeExpired() {

        // Remove expired data from denylist
        Iterator<Map.Entry<String, UserData>> current = denylist.entrySet().iterator();
        while (current.hasNext()) {

            // Remove entry from map if its associated with expired data
            Map.Entry<String, UserData> entry = current.next();
            if (entry.getValue().isExpired())
                current.remove();
            
        }

    }

    /**
     * Adds the given UserData to the denylist, storing it according to the
     * provided cryptographic signature. The UserData MUST have an associated
     * expiration timestamp. If any UserData objects already within the
     * denylist have expired, they will automatically be removed when this
     * function is invoked.
     *
     * @param data
     *     The UserData to store within the denylist.
     *
     * @param signature
     *     The cryptographic signature associated with the UserData.
     *
     * @return
     *     true if the UserData was not already denylisted and has
     *     successfully been added, false otherwise.
     */
    public boolean add(UserData data, byte[] signature) {

        // Expiration timestamps must be provided
        if (data.getExpires() == null) {
            logger.warn("An expiration timestamp MUST be provided for "
                    + "single-use data.");
            return false;
        }

        // Remove any expired entries
        removeExpired();

        // Expired user data is implicitly denylisted
        if (data.isExpired())
            return false;

        // Add to denylist only if not already present
        String signatureHex = BaseEncoding.base16().encode(signature);
        return denylist.putIfAbsent(signatureHex, data) == null;

    }

}
