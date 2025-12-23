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

package org.apache.guacamole.extension;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import org.apache.guacamole.resource.Resource;

/**
 * Service which provides access to all HTML patches as resources, and allows
 * other patch resources to be added.
 */
public class PatchResourceService {

    /**
     * A list of all HTML patch resources currently defined, in the order they
     * should be applied.
     */
    private final List<Resource> resources = new ArrayList<Resource>();

    /**
     * Adds the given HTML patch resource such that it will apply to the
     * Guacamole UI. The patch will be applied by the JavaScript side of the
     * web application in the order that addPatchResource() is invoked.
     *
     * @param resource
     *     The HTML patch resource to add. This resource must have the mimetype
     *     "text/html".
     */
    public void addPatchResource(Resource resource) {
        resources.add(resource);
    }

    /**
     * Adds the given HTML patch resources such that they will apply to the
     * Guacamole UI. The patches will be applied by the JavaScript side of the
     * web application in the order provided.
     *
     * @param resources
     *     The HTML patch resources to add. Each resource must have the
     *     mimetype "text/html".
     */
    public void addPatchResources(Collection<Resource> resources) {
        for (Resource resource : resources)
            addPatchResource(resource);
    }

    /**
     * Returns a list of all HTML patches currently associated with this
     * service, in the order they should be applied. The returned list cannot
     * be modified.
     *
     * @return
     *     A list of all HTML patches currently associated with this service.
     */
    public List<Resource> getPatchResources() {
        return Collections.unmodifiableList(resources);
    }

}
