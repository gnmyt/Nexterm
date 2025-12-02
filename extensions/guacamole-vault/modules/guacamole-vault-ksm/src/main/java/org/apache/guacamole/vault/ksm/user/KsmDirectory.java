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

package org.apache.guacamole.vault.ksm.user;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.DelegatingDirectory;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Identifiable;

/**
 * A KSM-specific version of DecoratingDirectory that exposes the underlying
 * directory for when it's needed.
 */
public abstract class KsmDirectory<ObjectType extends Identifiable>
        extends DelegatingDirectory<ObjectType> {

    /**
     * Create a new KsmDirectory, delegating to the provided directory.
     *
     * @param directory
     *    The directory to delegate to.
     */
    public KsmDirectory(Directory<ObjectType> directory) {
        super(directory);
    }

    /**
     * Returns the underlying directory that this DecoratingDirectory is
     * delegating to.
     *
     * @return
     *    The underlying directory.
     */
    public Directory<ObjectType> getUnderlyingDirectory() {
        return getDelegateDirectory();
    }

    /**
     * Process and return a potentially-modified version of the object
     * with the same identifier in the wrapped directory.
     *
     * @param object
     *     The object from the underlying directory.
     *
     * @return
     *     A potentially-modified version of the object with the same
     *     identifier in the wrapped directory.
     */
    protected abstract ObjectType wrap(ObjectType object);

    @Override
    public ObjectType get(String identifier) throws GuacamoleException {

        // Process and return the object from the wrapped directory
        return wrap(super.get(identifier));

    }

    @Override
    public Collection<ObjectType> getAll(Collection<String> identifiers)
            throws GuacamoleException {

        // Process and return each object from the wrapped directory
        return super.getAll(identifiers).stream().map(
                superObject -> wrap(superObject)
                ).collect(Collectors.toList());

    }

}
