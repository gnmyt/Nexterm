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

import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;

/**
 * Common base class for objects have an underlying model. For the purposes of
 * JDBC-driven authentication providers, all modeled objects are also
 * restricted.
 *
 * @param <ModelType>
 *     The type of model object which corresponds to this object.
 */
public abstract class ModeledObject<ModelType> extends RestrictedObject {

    /**
     * The internal model object containing the values which represent this
     * object in the database.
     */
    private ModelType model;

    /**
     * Initializes this object, associating it with the current authenticated
     * user and populating it with data from the given model object
     *
     * @param currentUser
     *     The user that created or retrieved this object.
     *
     * @param model 
     *     The backing model object.
     */
    public void init(ModeledAuthenticatedUser currentUser, ModelType model) {
        super.init(currentUser);
        setModel(model);
    }

    /**
     * Returns the backing model object. Changes to the model object will
     * affect this object, and changes to this object will affect the model
     * object.
     *
     * @return
     *     The backing model object.
     */
    public ModelType getModel() {
        return model;
    }

    /**
     * Sets the backing model object. This will effectively replace all data
     * contained within this object.
     *
     * @param model
     *     The backing model object.
     */
    public void setModel(ModelType model) {
        this.model = model;
    }

}
