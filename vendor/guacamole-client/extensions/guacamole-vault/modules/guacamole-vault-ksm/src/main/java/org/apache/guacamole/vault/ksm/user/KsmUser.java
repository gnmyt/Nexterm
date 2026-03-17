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

package org.apache.guacamole.vault.ksm.user;

import java.util.Map;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.DelegatingUser;
import org.apache.guacamole.vault.ksm.conf.KsmAttributeService;
import org.apache.guacamole.vault.ksm.conf.KsmConfigurationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.collect.Maps;
import com.google.inject.Inject;
import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;

 /**
  * A KSM-specific user implementation that exposes the
  * KSM_CONFIGURATION_ATTRIBUTE attribute even if no value is set. but only
  * if user-specific KSM configuration is enabled. The value of the attribute
  * will be sanitized if non-empty. This ensures that the attribute will always
  * show up in the UI when the feature is enabled, even for users that don't
  * already have it set, and that any sensitive information in the attribute
  * value will not be exposed.
  */
 public class KsmUser extends DelegatingUser {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(KsmUser.class);

    /**
     * Service for retrieving KSM configuration details.
     */
    @Inject
    private KsmConfigurationService configurationService;

    /**
     * Create a new Ksmuser wrapping the provided User record.
     *
     * @param user
     *     The User record to wrap.
     */
    @AssistedInject
    KsmUser(@Assisted User user) {
        super(user);
    }

    /**
     * Return the underlying wrapped user record.
     *
     * @return
     *     The wrapped user record.
     */
    User getUnderlyingUser() {
        return getDelegateUser();
    }

    @Override
    public Map<String, String> getAttributes() {

        // Make a copy of the existing map
        Map<String, String> attributes = Maps.newHashMap(super.getAttributes());

        // Figure out if user-level KSM config is enabled
        boolean userKsmConfigEnabled = false;
        try {
            userKsmConfigEnabled = configurationService.getAllowUserConfig();
        } catch (GuacamoleException e) {

            logger.warn(
                    "Disabling user KSM config due to exception: {}"
                    , e.getMessage());
            logger.debug("Error looking up if user KSM config is enabled.", e);

        }

        // If user-specific KSM configuration is not enabled, do not expose the
        // attribute at all
        if (!userKsmConfigEnabled)
            attributes.remove(KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE);

        else
            // Sanitize the KSM configuration attribute, and ensure the attribute
            // is always present
            attributes.put(
                    KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE,
                    KsmAttributeService.sanitizeKsmAttributeValue(
                        attributes.get(KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE)));

        return attributes;
    }

 }