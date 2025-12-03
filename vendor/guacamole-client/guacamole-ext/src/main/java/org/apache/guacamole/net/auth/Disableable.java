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

package org.apache.guacamole.net.auth;

/**
 * An interface that defines items that can be enabled or disabled.
 */
public interface Disableable {
    
    /**
     * Returns true if this object is disabled, otherwise false.
     * 
     * @return 
     *     True if this object is disabled, otherwise false.
     */
    default public boolean isDisabled() {
        return false;
    }
    
    /**
     * Set the disabled status of this object to the boolean value provided,
     * true if the object should be disabled, otherwise false.
     * 
     * @param disabled 
     *     True if the object should be disabled, otherwise false.
     */
    default public void setDisabled(boolean disabled) {
        // Default implementation takes no action.
    }
    
}
