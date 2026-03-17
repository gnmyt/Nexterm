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

package org.apache.guacamole.vault.secret;

import java.util.Map;
import java.util.concurrent.Future;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Connectable;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.token.TokenFilter;

/**
 * Generic service for retrieving the value of a secret stored in a vault.
 */
public interface VaultSecretService {

    /**
     * Translates an arbitrary string, which may contain characters not allowed
     * by the vault implementation, into a string which is valid within a
     * secret name. The type of transformation performed on the string, if any,
     * will depend on the specific requirements of the vault provider.
     *
     * NOTE: It is critical that this transformation is deterministic and
     * reasonably predictable for users. If an implementation must apply a
     * transformation to secret names, that transformation needs to be
     * documented.
     *
     * @param nameComponent
     *     An arbitrary string intended for use within a secret name, but which
     *     may contain characters not allowed by the vault implementation.
     *
     * @return
     *     A string containing essentially the same content as the provided
     *     string, but transformed deterministically such that it is acceptable
     *     as a component of a secret name by the vault provider.
     */
    String canonicalize(String nameComponent);

    /**
     * Returns a Future which eventually completes with the value of the secret
     * having the given name. If no such secret exists, the Future will be
     * completed with null. The secrets retrieved from this method are independent
     * of the context of the particular connection being established, or any
     * associated user context.
     *
     * @param name
     *     The name of the secret to retrieve.
     *
     * @return
     *     A Future which completes with value of the secret having the given
     *     name. If no such secret exists, the Future will be completed with
     *     null. If an error occurs asynchronously which prevents retrieval of
     *     the secret, that error will be exposed through an ExecutionException
     *     when an attempt is made to retrieve the value from the Future.
     *
     * @throws GuacamoleException
     *     If the secret cannot be retrieved due to an error.
     */
    Future<String> getValue(String name) throws GuacamoleException;

    /**
     * Returns a Future which eventually completes with the value of the secret
     * having the given name. If no such secret exists, the Future will be
     * completed with null. The connection or connection group, as well as the
     * user context associated with the request are provided for additional context.
     *
     * @param userContext
     *     The user context associated with the connection or connection group for
     *     which the secret is being retrieved.
     *
     * @param connectable
     *     The connection or connection group for which the secret is being retrieved.
     *
     * @param name
     *     The name of the secret to retrieve.
     *
     * @return
     *     A Future which completes with value of the secret having the given
     *     name. If no such secret exists, the Future will be completed with
     *     null. If an error occurs asynchronously which prevents retrieval of
     *     the secret, that error will be exposed through an ExecutionException
     *     when an attempt is made to retrieve the value from the Future.
     *
     * @throws GuacamoleException
     *     If the secret cannot be retrieved due to an error.
     */
    Future<String> getValue(UserContext userContext, Connectable connectable,
            String name) throws GuacamoleException;

    /**
     * Returns a map of token names to corresponding Futures which eventually
     * complete with the value of that token, where each token is dynamically
     * defined based on connection parameters. If a vault implementation allows
     * for predictable secrets based on the parameters of a connection, this
     * function should be implemented to provide automatic tokens for those
     * secrets and remove the need for manual mapping via YAML.
     *
     * @param userContext
     *     The user context from which the connectable originated.
     *
     * @param connectable
     *     The connection or connection group for which the tokens are being replaced.
     *
     * @param config
     *     The configuration of the Guacamole connection for which tokens are
     *     being generated. This configuration may be empty or partial,
     *     depending on the underlying implementation.
     *
     * @param filter
     *     A TokenFilter instance that applies any tokens already available to
     *     be applied to the configuration of the Guacamole connection. These
     *     tokens will consist of tokens already supplied to connect().
     *
     * @return
     *     A map of token names to their corresponding future values, where
     *     each token and value may be dynamically determined based on the
     *     connection configuration.
     *
     * @throws GuacamoleException
     *     If an error occurs producing the tokens and values required for the
     *     given configuration.
     */
    Map<String, Future<String>> getTokens(UserContext userContext, Connectable connectable,
            GuacamoleConfiguration config, TokenFilter filter) throws GuacamoleException;

}
