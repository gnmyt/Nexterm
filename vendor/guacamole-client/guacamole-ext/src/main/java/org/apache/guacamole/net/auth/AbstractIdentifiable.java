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

package org.apache.guacamole.net.auth;

import org.apache.guacamole.properties.CaseSensitivity;

/**
 * Abstract implementation of Identifiable which provides equals() and
 * hashCode() implementations which use the identifier to determine equality.
 * The identifier comparison is case-sensitive unless configured otherwise via
 * the {@link AbstractIdentifiable#AbstractIdentifiable(boolean)} constructor.
 *
 * If using case-insensitive identifiers, any identifiers that are retrieved
 * from or assigned to this object will first be canonicalized to a
 * case-insensitive form using {@link CaseSensitivity#canonicalize(java.lang.String, boolean)}.
 */
public abstract class AbstractIdentifiable implements Identifiable {

    /**
     * The unique string which identifies this object.
     */
    private String identifier;

    /**
     * Whether this object's identifier should be compared in a case-sensitive
     * manner. If NOT case-sensitive, the identifier will be transformed into a
     * canonical, case-insensitive form before use, including during assignment
     * and retrieval. This affects the behavior of getIdentifier() and
     * setIdentifier().
     */
    private final boolean caseSensitive;

    /**
     * Creates a new AbstractIdentifiable that compares identifiers according
     * to the provided case sensitivity flag. If using case-insensitive
     * identifiers, any identifiers that are retrieved from or assigned to this
     * object will first be canonicalized to a case-insensitive form using
     * {@link CaseSensitivity#canonicalize(java.lang.String, boolean)}.
     *
     * @param caseSensitive
     *     true if identifiers should be compared in a case-sensitive manner,
     *     false otherwise.
     */
    public AbstractIdentifiable(boolean caseSensitive) {
        this.caseSensitive = caseSensitive;
    }

    /**
     * Creates a new AbstractIdentifiable that compares identifiers in a
     * case-sensitive manner. This is equivalent to invoking {@link #AbstractIdentifiable(boolean)}
     * with the case sensitivity flag set to true.
     */
    public AbstractIdentifiable() {
        this(true);
    }

    @Override
    public String getIdentifier() {
        return CaseSensitivity.canonicalize(identifier, caseSensitive);
    }

    @Override
    public void setIdentifier(String identifier) {
        this.identifier = CaseSensitivity.canonicalize(identifier, caseSensitive);
    }

    @Override
    public int hashCode() {

        String thisIdentifier = getIdentifier();
        if (thisIdentifier == null)
            return 0;

        return thisIdentifier.hashCode();

    }

    @Override
    public boolean equals(Object other) {

        // Not equal if null or not the same type of object
        if (other == null || getClass() != other.getClass())
            return false;

        // Get identifiers of objects being compared
        String thisIdentifier = getIdentifier();
        String otherIdentifier = ((AbstractIdentifiable) other).getIdentifier();

        // If null, equal only if this identifier is null
        if (otherIdentifier == null)
            return thisIdentifier == null;

        // Otherwise, equal only if strings are identical
        return otherIdentifier.equals(thisIdentifier);

    }

}
