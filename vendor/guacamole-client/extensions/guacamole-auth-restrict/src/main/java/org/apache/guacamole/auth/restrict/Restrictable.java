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
package org.apache.guacamole.auth.restrict;

import org.apache.guacamole.calendar.RestrictionType;
import org.apache.guacamole.net.auth.Attributes;

/**
 * An interface which defines methods that apply to items that can have
 * restrictions applied to them.
 */
public interface Restrictable extends Attributes {
    
    /**
     * Return the restriction state for this restrictable object at the
     * current date and time. By default returns an implicit denial.
     * 
     * @return 
     *     The restriction status for the current date and time.
     */
    default public RestrictionType getCurrentTimeRestriction() {
        return RestrictionType.IMPLICIT_DENY;
    }
    
    /**
     * Return the restriction state for this restrictable object for the host
     * from which the current user is logged in. By default returns an implicit
     * denial.
     * 
     * @return 
     *     The restriction status for the host from which the current user is
     *     logged in.
     */
    default public RestrictionType getCurrentHostRestriction() {
        return RestrictionType.IMPLICIT_DENY;
    }
    
    /**
     * Returns true if the current item is available based on the restrictions
     * for the given implementation of this interface, or false if the item is
     * not currently available. The default implementation checks current time
     * and host restrictions, allowing if both those restrictions allow access.
     * 
     * @return 
     *     true if the item is available, otherwise false.
     */
    default public boolean isAvailable() {
        return (getCurrentTimeRestriction().isAllowed() && getCurrentHostRestriction().isAllowed());
    }
    
}