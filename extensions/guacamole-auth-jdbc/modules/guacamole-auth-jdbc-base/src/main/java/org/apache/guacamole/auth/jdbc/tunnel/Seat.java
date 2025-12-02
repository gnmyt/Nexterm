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

package org.apache.guacamole.auth.jdbc.tunnel;

/**
 * A unique pairing of user and connection or connection group.
 */
public class Seat {

    /**
     * The user using this seat.
     */
    private final String username;

    /**
     * The connection or connection group associated with this seat.
     */
    private final String identifier;

    /**
     * Creates a new seat which associated the given user with the given
     * connection or connection group.
     *
     * @param username
     *     The username of the user using this seat.
     *
     * @param identifier
     *     The identifier of the connection or connection group associated with
     *     this seat.
     */
    public Seat(String username, String identifier) {
        this.username = username;
        this.identifier = identifier;
    }

    @Override
    public int hashCode() {

        // The various properties will never be null
        assert(username != null);
        assert(identifier != null);

        // Derive hashcode from username and connection identifier
        int hash = 5;
        hash = 37 * hash + username.hashCode();
        hash = 37 * hash + identifier.hashCode();
        return hash;

    }

    @Override
    public boolean equals(Object object) {

        // We are only comparing against other seats here
        assert(object instanceof Seat);
        Seat seat = (Seat) object;

        // The various properties will never be null
        assert(seat.username != null);
        assert(seat.identifier != null);

        return username.equals(seat.username)
            && identifier.equals(seat.identifier);

    }
  
}
