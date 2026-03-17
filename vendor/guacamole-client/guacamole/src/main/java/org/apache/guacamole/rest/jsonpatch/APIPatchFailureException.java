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

package org.apache.guacamole.rest.jsonpatch;

import java.util.List;

import org.apache.guacamole.GuacamoleClientException;

/**
 * An exception describing a failure to apply the patches from a JSON Patch
 * request. A list of outcomes is included, one for each patch in the request.
 */
public class APIPatchFailureException extends GuacamoleClientException {

    /**
     * A list of outcomes, each one corresponding to a patch in the request
     * corresponding to this response. This may include a mix of successes and
     * failures. Any failure will result in a failure of the entire request
     * since JSON Patch requests are handled atomically.
     */
    public final List<APIPatchOutcome> patches;

    /**
     * Create a new patch request failure with the provided list of outcomes
     * for individual patches.
     *
     * @param message
     *     A human-readable message describing the overall request failure.
     *
     * @param patches
     *     A list of patch outcomes, one for each patch in the request
     *     associated with this response.
     */
    public APIPatchFailureException(
            String message, List<APIPatchOutcome> patches) {

        super(message);
        this.patches = patches;
    }

    /**
     * Return the outcome for each patch in the request corresponding to this
     * response.
     */
    public List<APIPatchOutcome> getPatches() {
        return patches;
    }

}
