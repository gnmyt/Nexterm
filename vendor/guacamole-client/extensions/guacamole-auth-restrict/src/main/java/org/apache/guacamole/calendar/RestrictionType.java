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
package org.apache.guacamole.calendar;

/**
 * A data type that represents various values of what type of restriction applies
 * at a given time.
 */
public enum RestrictionType {
    
    /**
     * Access is explicitly allowed.
     */
    EXPLICIT_ALLOW(1, true),
    
    /**
     * Access is explicitly denied.
     */
    EXPLICIT_DENY(0, false),
    
    /**
     * Access has not been explicitly allowed or denied, therefore it is
     * implicitly allowed.
     */
    IMPLICIT_ALLOW(3, true),
    
    /**
     * Access has not been explicitly allowed or denied, therefore it is
     * implicitly denied.
     */
    IMPLICIT_DENY(2, false);
    
    /**
     * The overall priority of the restriction, with zero being the highest
     * priority and the priority decreasing as numbers increase from zero.
     */
    final private int priority;
    
    /**
     * true if the restriction allows access, otherwise false.
     */
    final private boolean allowed;
    
    /**
     * Create the new instance of this RestrictionType, with the given
     * priority value for the instance.
     * 
     * @param priority 
     *     The priority of the restriction type, where zero is the highest
     *     priority.
     * 
     * @param allowed
     *     true if the restriction allows access, otherwise false.
     */
    RestrictionType(int priority, boolean allowed) {
        this.priority = priority;
        this.allowed = allowed;
    }
    
    /**
     * Evaluates two restrictions, returning the higher priority of the two.
     * 
     * @param restriction1
     *     The first restriction to compare.
     * 
     * @param restriction2
     *     The second restriction to compare.
     * 
     * @return 
     *     Return which of the two restrictions is the higher-priority.
     */
    public static RestrictionType getHigherPriority(RestrictionType restriction1, RestrictionType restriction2) {
        
        // If the second is higher than the first, return the second.
        if (restriction1.priority > restriction2.priority)
            return restriction2;
        
        // Return the first.
        return restriction1;
        
    }
    
    /**
     * Returns true if this restriction allows access, otherwise false.
     * 
     * @return 
     *     true if this restriction allows access, otherwise false.
     */
    public boolean isAllowed() {
        return this.allowed;
    }
    
}
