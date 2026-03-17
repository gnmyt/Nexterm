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

package org.apache.guacamole.auth.quickconnect.conf;

import com.google.inject.Inject;
import java.util.Collection;
import java.util.List;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.StringGuacamoleProperty;

/**
 * Configuration options to control the QuickConnect module.
 */
public class ConfigurationService {
   
    /**
     * The environment of the Guacamole Server.
     */ 
    @Inject
    private Environment environment;
    
    /**
     * A list of parameters that, if set, will limit the parameters allowed to
     * be defined by connections created using the QuickConnect module to only
     * the parameters defined in this list.  Defaults to null (all parameters
     * are allowed).
     */
    public static final StringGuacamoleProperty QUICKCONNECT_ALLOWED_PARAMETERS = new StringGuacamoleProperty() {
        
        @Override
        public String getName() { return "quickconnect-allowed-parameters"; }
        
    };
    
    /**
     * A list of parameters that, if set, will limit the parameters allowed to
     * be defined by connections created using the QuickConnect module to any
     * except the ones defined in this list.  Defaults to null (all parameters
     * are allowed).
     */
    public static final StringGuacamoleProperty QUICKCONNECT_DENIED_PARAMETERS = new StringGuacamoleProperty() {
        
        @Override
        public String getName() { return "quickconnect-denied-parameters"; }
        
    };
    
    /**
     * Return the list of allowed parameters to be set by connections created
     * using the QuickConnect module, or null if none are defined (thereby
     * allowing all parameters to be set).
     * 
     * @return 
     *    The list of allowed parameters to be set by connections crated using
     *    the QuickConnect module.
     * 
     * @throws GuacamoleException
     *    If guacamole.properties cannot be parsed.
     */
    public Collection<String> getAllowedParameters() throws GuacamoleException {
        return environment.getPropertyCollection(QUICKCONNECT_ALLOWED_PARAMETERS);
    }
    
    /**
     * Return the list of denied parameters for connections created using the
     * QuickConnect module, or null if none are defined (thereby allowing all
     * parameters to be set).
     * 
     * @return
     *     The list of parameters that cannot be set by connections created
     *     using the QuickConnect module.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    public Collection<String> getDeniedParameters() throws GuacamoleException {
        return environment.getPropertyCollection(QUICKCONNECT_DENIED_PARAMETERS);
    }
    
}
