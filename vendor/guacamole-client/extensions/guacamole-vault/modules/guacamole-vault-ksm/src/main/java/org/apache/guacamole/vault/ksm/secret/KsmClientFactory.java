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

package org.apache.guacamole.vault.ksm.secret;

import javax.annotation.Nonnull;

import com.keepersecurity.secretsManager.core.SecretsManagerOptions;

/**
 * Factory for creating KsmClient instances.
 */
public interface KsmClientFactory {

    /**
     * Returns a new instance of a KsmClient instance associated with
     * the provided KSM configuration options and API interval.
     *
     * @param ksmConfigOptions
     *     The KSM config options to use when constructing the KsmClient
     *     object.
     *
     * @param apiInterval
     *     The minimum number of milliseconds that must elapse between KSM API
     *     calls.
     *
     * @return
     *     A new KsmClient instance associated with the provided KSM config
     *     options.
     */
    KsmClient create(
            @Nonnull SecretsManagerOptions ksmConfigOptions, long apiInterval);

}
