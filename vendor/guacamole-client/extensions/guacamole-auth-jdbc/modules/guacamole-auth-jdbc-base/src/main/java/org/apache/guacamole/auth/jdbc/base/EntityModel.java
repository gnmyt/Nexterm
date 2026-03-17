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

/**
 * Base representation of a Guacamole object that can be granted permissions
 * (an "entity"), such as a user or user group, as represented in the database.
 * Each entity has three base properties:
 *
 *   1. The "entityID", which points to the common entry in the
 *      guacamole_entity table and is common to any type of entity.
 *
 *   2. The "objectID", which points to the type-specific entry for the object
 *      in question (ie: an entry in guacamole_user or guacamole_user_group).
 *
 *   3. The "identifier", which contains the unique "name" value defined for
 *      the entity within the guacamole_entity table.
 */
public abstract class EntityModel extends ObjectModel {

    /**
     * The ID of the entity entry which corresponds to this object in the
     * database, if any. Note that this is distinct from the objectID,
     * inherited from ObjectModel, which is specific to the actual type of
     * object represented by the entity.
     */
    private Integer entityID;

    /**
     * The type of object represented by the entity (user or user group).
     */
    private EntityType type;

    /**
     * Creates a new, empty entity.
     */
    public EntityModel() {
    }

    /**
     * Creates a new entity of the given type which is otherwise empty.
     *
     * @param type
     *     The type to assign to the new entity.
     */
    public EntityModel(EntityType type) {
        this.type = type;
    }

    /**
     * Returns the ID of the entity entry which corresponds to this object in
     * the database, if it exists. Note that this is distinct from the objectID,
     * inherited from ObjectModel, which is specific to the actual type of
     * object represented by the entity.
     *
     * @return
     *     The ID of this entity in the database, or null if this entity was
     *     not retrieved from the database.
     */
    public Integer getEntityID() {
        return entityID;
    }

    /**
     * Sets the ID of this entity to the given value.
     *
     * @param entityID
     *     The ID to assign to this entity.
     */
    public void setEntityID(Integer entityID) {
        this.entityID = entityID;
    }

    /**
     * Returns the type of object represented by the entity. Each entity may be
     * either a user or a user group.
     *
     * @return
     *     The type of object represented by the entity.
     */
    public EntityType getEntityType() {
        return type;
    }

    /**
     * Sets the type of object represented by the entity. Each entity may be
     * either a user or a user group.
     *
     * @param type
     *     The type of object represented by the entity.
     */
    public void setEntityType(EntityType type) {
        this.type = type;
    }

}
