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

package org.apache.guacamole.rest.identifier;

import java.util.List;
import java.util.Set;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.RelatedObjectSet;
import org.apache.guacamole.rest.jsonpatch.APIPatch;

/**
 * A REST resource which abstracts the operations available on arbitrary sets
 * of objects which share some common relation.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RelatedObjectSetResource {

    /**
     * The path of any operation within a JSON patch which adds/removes an
     * object from the associated set.
     */
    private static final String OBJECT_PATH = "/";

    /**
     * The set of objects represented by this RelatedObjectSetResource.
     */
    private final RelatedObjectSet objects;

    /**
     * Creates a new RelatedObjectSetResource which exposes the operations and
     * subresources available for the given RelatedObjectSet.
     *
     * @param objects
     *     The RelatedObjectSet exposed by this RelatedObjectSetResource.
     */
    public RelatedObjectSetResource(RelatedObjectSet objects) {
        this.objects = objects;
    }

    /**
     * Returns the identifiers of all objects within RelatedObjectSet exposed by
     * this RelatedObjectSetResource.
     *
     * @return
     *     The identifiers of all objects within RelatedObjectSet exposed by
     *     this RelatedObjectSetResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the objects within the set, or
     *     if objects cannot be retrieved due to lack of permissions to do so.
     */
    @GET
    public Set<String> getObjects() throws GuacamoleException {
        return objects.getObjects();
    }

    /**
     * Updates the given RelatedObjectSetPatch by queuing an add or remove
     * operation for the object having the given identifier based on the given
     * patch operation.
     *
     * @param operation
     *     The patch operation to perform.
     *
     * @param relatedObjectSetPatch
     *     The RelatedObjectSetPatch being modified.
     *
     * @param identifier
     *     The identifier of the object being added or removed from the set.
     *
     * @throws GuacamoleException
     *     If the requested patch operation is not supported.
     */
    private void updateRelatedObjectSet(APIPatch.Operation operation,
            RelatedObjectSetPatch relatedObjectSetPatch, String identifier)
            throws GuacamoleException {

        // Add or remove object based on operation
        switch (operation) {

            // Add object
            case add:
                relatedObjectSetPatch.addObject(identifier);
                break;

            // Remove object
            case remove:
                relatedObjectSetPatch.removeObject(identifier);
                break;

            // Unsupported patch operation
            default:
                throw new GuacamoleClientException("Unsupported patch operation: \"" + operation + "\"");

        }

    }

    /**
     * Applies a given list of patches to the RelatedObjectSet exposed by this
     * RelatedObjectSetResource. Each patch specifies either
     * an "add" or a "remove" operation for a particular object represented
     * by its identifier. The path of each operation MUST be "/", with the
     * identifier of the object being provided within the value of the patch.
     *
     * @param patches
     *     The patches to apply for this request.
     *
     * @throws GuacamoleException
     *     If an error is encountered while modifying the contents of the
     *     RelatedObjectSet.
     */
    @PATCH
    public void patchObjects(List<APIPatch<String>> patches)
            throws GuacamoleException {

        // Apply all patch operations individually
        RelatedObjectSetPatch objectPatch = new RelatedObjectSetPatch();
        for (APIPatch<String> patch : patches) {

            String path = patch.getPath();

            // Add/remove objects from set
            if (path.equals(OBJECT_PATH)) {
                String identifier = patch.getValue();
                updateRelatedObjectSet(patch.getOp(), objectPatch, identifier);
            }

            // Otherwise, the path is not supported
            else
                throw new GuacamoleClientException("Unsupported patch path: \"" + path + "\"");

        } // end for each patch operation

        // Save changes
        objectPatch.apply(objects);

    }

}
