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

import org.apache.guacamole.rest.jsonpatch.APIPatch.Operation;

/**
 * A successful outcome associated with a particular patch within a JSON Patch
 * request. The outcome contains the operation requested by the original patch,
 * the path from the original patch, and the identifier of the object corresponding
 * to the value from the original patch.
 *
 * The purpose of this class is to present a relatively lightweight outcome for
 * the user who submitted the Patch request. Rather than including the full
 * contents of the value, only the identifier is included, allowing the user to
 * determine the identifier of any newly-created objects as part of the request.
 */
public class APIPatchOutcome {

    /**
     * The requested operation for the patch corresponding to this outcome.
     */
    private final Operation op;

    /**
     * The identifier for the value in patch corresponding to this outcome.
     * If the value in the patch was null, this identifier should also be null.
     */
    private String identifier;

    /**
     * The path for the patch corresponding to this outcome.
     */
    private final String path;

    /**
     * Create an outcome associated with a submitted patch, as part of a JSON
     * patch API request.
     *
     * @param op
     *     The requested operation for the patch corresponding to this outcome.
     *
     * @param identifier
     *     The identifier for the value in patch corresponding to this outcome.
     *
     * @param path
     *     The path for the patch corresponding to this outcome.
     */
    public APIPatchOutcome(Operation op, String identifier, String path) {
        this.op = op;
        this.identifier = identifier;
        this.path = path;
    }

    /**
     * Clear the identifier associated with this patch outcome. This must
     * be done when an identifier in a outcome refers to a temporary object
     * that was rolled back during processing of a request.
     */
    public void clearIdentifier() {
        this.identifier = null;
    }

    /**
     * Returns the requested operation for the patch corresponding to this
     * outcome.
     *
     * @return
     *     The requested operation for the patch corresponding to this outcome.
     */
    public Operation getOp() {
        return op;
    }

    /**
     * Returns the path for the patch corresponding to this outcome.
     *
     * @return
     *     The path for the patch corresponding to this outcome.
     */
    public String getPath() {
        return path;
    }

    /**
     * Returns the identifier for the value in patch corresponding to this
     * outcome, or null if the value in the patch was null.
     *
     * @return
     *     The identifier for the value in patch corresponding to this
     *     outcome, or null if the value was null.
     */
    public String getIdentifier() {
        return identifier;
    }

}
