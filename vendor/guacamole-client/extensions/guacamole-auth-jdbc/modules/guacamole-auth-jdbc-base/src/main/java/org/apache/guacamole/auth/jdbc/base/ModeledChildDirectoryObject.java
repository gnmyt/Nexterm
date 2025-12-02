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

package org.apache.guacamole.auth.jdbc.base;

import org.apache.guacamole.auth.jdbc.connectiongroup.RootConnectionGroup;

/**
 * Common base class for objects that will ultimately be made available through
 * the Directory class. All such objects will need the same base set of queries
 * to fulfill the needs of the Directory class.
 *
 * @param <ModelType>
 *     The type of model object that corresponds to this object.
 */
public abstract class ModeledChildDirectoryObject<ModelType extends ChildObjectModel>
    extends ModeledDirectoryObject<ModelType> {

    /**
     * Returns the identifier of the parent connection group, which cannot be
     * null. If the parent is the root connection group, this will be
     * RootConnectionGroup.IDENTIFIER.
     *
     * @return
     *     The identifier of the parent connection group.
     */
    public String getParentIdentifier() {

        // Translate null parent to proper identifier
        String parentIdentifier = getModel().getParentIdentifier();
        if (parentIdentifier == null)
            return RootConnectionGroup.IDENTIFIER;

        return parentIdentifier;
        
    }

    /**
     * Sets the identifier of the associated parent connection group. If the
     * parent is the root connection group, this should be
     * RootConnectionGroup.IDENTIFIER.
     * 
     * @param parentIdentifier
     *     The identifier of the connection group to associate as this object's
     *     parent.
     */
    public void setParentIdentifier(String parentIdentifier) {

        // Translate root identifier back into null
        if (parentIdentifier != null
                && parentIdentifier.equals(RootConnectionGroup.IDENTIFIER))
            parentIdentifier = null;

        getModel().setParentIdentifier(parentIdentifier);

    }

}
