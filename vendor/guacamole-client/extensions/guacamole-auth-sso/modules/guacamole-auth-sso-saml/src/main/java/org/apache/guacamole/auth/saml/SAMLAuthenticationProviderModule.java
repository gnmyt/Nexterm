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

package org.apache.guacamole.auth.saml;

import com.google.inject.AbstractModule;
import org.apache.guacamole.auth.saml.conf.ConfigurationService;
import org.apache.guacamole.auth.saml.acs.AssertionConsumerServiceResource;
import org.apache.guacamole.auth.saml.acs.SAMLAuthenticationSessionManager;
import org.apache.guacamole.auth.saml.acs.SAMLService;
import org.apache.guacamole.auth.saml.conf.SAMLEnvironment;
import org.apache.guacamole.environment.Environment;

/**
 * Guice module which configures SAML-specific injections.
 */
public class SAMLAuthenticationProviderModule extends AbstractModule {

    /**
     * The environment for this server and extension.
     */
    private final Environment environment = new SAMLEnvironment();
    
    @Override
    protected void configure() {
        bind(AssertionConsumerServiceResource.class);
        bind(ConfigurationService.class);
        bind(SAMLAuthenticationSessionManager.class);
        bind(SAMLService.class);
        
        bind(Environment.class).toInstance(environment);
        
        requestStaticInjection(SAMLAuthenticationEventListener.class);
    }

}
