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

import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.DelegatingConnectionGroup;
import org.apache.guacamole.vault.ksm.conf.KsmAttributeService;

import com.google.common.collect.Maps;

 /**
  * A KSM-specific connection group implementation that always exposes
  * the KSM_CONFIGURATION_ATTRIBUTE attribute, even when no value is set.
  * The value of the attribute will be sanitized if non-empty. This ensures
  * that the attribute will always show up in the UI, even for connection
  * groups that don't already have it set, and that any sensitive information
  * in the attribute value will not be exposed.
  */
 public class KsmConnectionGroup extends DelegatingConnectionGroup {

    /**
     * Create a new KsmConnectionGroup wrapping the provided ConnectionGroup record.
     *
     * @param connectionGroup
     *     The ConnectionGroup record to wrap.
     */
    KsmConnectionGroup(ConnectionGroup connectionGroup) {
        super(connectionGroup);
    }

    /**
     * Return the underlying wrapped connection group record.
     *
     * @return
     *     The wrapped connection group record.
     */
    ConnectionGroup getUnderlyingConnectionGroup() {
        return getDelegateConnectionGroup();
    }

    /**
     * Return the underlying ConnectionGroup that's wrapped by this KsmConnectionGroup.
     *
     * @return
     *     The underlying ConnectionGroup that's wrapped by this KsmConnectionGroup.
     */
    ConnectionGroup getUnderlyConnectionGroup() {
        return getDelegateConnectionGroup();
    }

    @Override
    public Map<String, String> getAttributes() {

        // Make a copy of the existing map
        Map<String, String> attributes = Maps.newHashMap(super.getAttributes());

        // Sanitize the KSM configuration attribute, and ensure the attribute
        // is always present
        attributes.put(
                KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE,
                KsmAttributeService.sanitizeKsmAttributeValue(
                    attributes.get(KsmAttributeService.KSM_CONFIGURATION_ATTRIBUTE)));

        return attributes;
    }

 }