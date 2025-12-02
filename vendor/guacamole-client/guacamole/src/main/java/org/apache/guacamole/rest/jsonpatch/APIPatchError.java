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

import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.rest.jsonpatch.APIPatch.Operation;

/**
 * A failure outcome associated with a particular patch within a JSON Patch
 * request. This status indicates that a particular patch failed to apply,
 * and includes the error describing the failure, along with the operation and
 * path from the original patch, and the identifier of the object
 * referenced by the original patch.
 */
public class APIPatchError extends APIPatchOutcome {

    /**
     * The error associated with the submitted patch.
     */
    private final TranslatableMessage error;

    /**
     * Create a failure status associated with a submitted patch from a JSON
     * patch API request.
     *
     * @param op
     *     The operation requested by the failed patch.
     *
     * @param identifier
     *     The identifier of the object associated with the failed patch. If
     *     the patch failed to create a new object, this will be null.
     *
     * @param path
     *     The patch from the failed patch.
     *
     * @param error
     *     The error message associated with the failure that prevented the
     *     patch from applying.
     */
    public APIPatchError(
            Operation op, String identifier, String path,
            TranslatableMessage error) {
        super(op, identifier, path);
        this.error = error;
    }

    /**
     * Return the error associated with the patch failure.
     *
     * @return
     *     The error associated with the patch failure.
     */
    public TranslatableMessage getError() {
        return error;
    }
}
