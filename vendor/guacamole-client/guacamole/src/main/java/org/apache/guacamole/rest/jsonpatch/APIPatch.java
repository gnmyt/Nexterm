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

/**
 * An object for representing an entry within the body of a
 * JSON PATCH request. See https://tools.ietf.org/html/rfc6902
 *
 * @param <T>
 *     The type of object being patched.
 */
public class APIPatch<T> {
    
    /**
     * The possible operations for a PATCH request.
     */
    public enum Operation {
        add, remove, test, copy, replace, move
    }
    
    /**
     * The operation to perform for this patch.
     */
    private Operation op;
    
    /**
     * The value for this patch.
     */
    private T value;
    
    /**
     * The path for this patch.
     */
    private String path;

    /**
     * Returns the operation for this patch.
     * @return the operation for this patch. 
     */
    public Operation getOp() {
        return op;
    }

    /**
     * Set the operation for this patch.
     * @param op The operation for this patch.
     */
    public void setOp(Operation op) {
        this.op = op;
    }

    /**
     * Returns the value of this patch.
     * @return The value of this patch.
     */
    public T getValue() {
        return value;
    }

    /**
     * Sets the value of this patch.
     * @param value The value of this patch.
     */
    public void setValue(T value) {
        this.value = value;
    }

    /**
     * Returns the path for this patch.
     * @return The path for this patch.
     */
    public String getPath() {
        return path;
    }

    /**
     * Set the path for this patch.
     * @param path The path for this patch.
     */
    public void setPath(String path) {
        this.path = path;
    }

}
