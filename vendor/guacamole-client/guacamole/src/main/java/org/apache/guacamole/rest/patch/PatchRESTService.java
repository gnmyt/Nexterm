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

package org.apache.guacamole.rest.patch;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;
import javax.inject.Inject;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.extension.PatchResourceService;
import org.apache.guacamole.resource.Resource;

/**
 * A REST Service for handling the listing of HTML patches.
 */
@Path("/patches")
@Produces(MediaType.APPLICATION_JSON)
public class PatchRESTService {

    /**
     * Service for retrieving information regarding available HTML patch
     * resources.
     */
    @Inject
    private PatchResourceService patchResourceService;

    /**
     * Reads the entire contents of the given resource as a String. The
     * resource is assumed to be encoded in UTF-8.
     *
     * @param resource
     *     The resource to read as a new String.
     *
     * @return
     *     A new String containing the contents of the given resource.
     *
     * @throws IOException
     *     If an I/O error prevents reading the resource.
     */
    private String readResourceAsString(Resource resource) throws IOException {

        StringBuilder contents = new StringBuilder();

        // Read entire resource into StringBuilder one chunk at a time
        Reader reader = new InputStreamReader(resource.asStream(), "UTF-8");
        try {

            char buffer[] = new char[8192];
            int length;

            while ((length = reader.read(buffer)) != -1) {
                contents.append(buffer, 0, length);
            }

        }

        // Ensure resource is always closed
        finally {
            reader.close();
        }

        return contents.toString();

    }

    /**
     * Returns a list of all available HTML patches, in the order they should
     * be applied. Each patch is raw HTML containing additional meta tags
     * describing how and where the patch should be applied.
     *
     * @return
     *     A list of all HTML patches defined in the system, in the order they
     *     should be applied.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing any HTML patch from being read.
     */
    @GET
    public List<String> getPatches() throws GuacamoleException {

        try {

            // Allocate a list of equal size to the total number of patches
            List<Resource> resources = patchResourceService.getPatchResources();
            List<String> patches = new ArrayList<String>(resources.size());

            // Convert each patch resource to a string
            for (Resource resource : resources) {
                patches.add(readResourceAsString(resource));
            }

            // Return all patches in string form
            return patches;

        }

        // Bail out entirely on error
        catch (IOException e) {
            throw new GuacamoleServerException("Unable to read HTML patches.", e);
        }

    }

}
