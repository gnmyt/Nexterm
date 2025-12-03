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

package org.apache.guacamole.net.event;

/**
 * An event which is triggered whenever a user's credentials have been
 * submitted for authentication, but that latest authentication request has not
 * yet succeeded or failed. The credentials that were received for
 * authentication are included within this event, and can be retrieved using
 * {@link #getCredentials()}.
 * <p>
 * If a {@link org.apache.guacamole.net.event.listener.Listener} throws
 * a GuacamoleException when handling an event of this type, the authentication
 * request is entirely aborted as if it failed, and will be processed by any
 * other listener or authentication provider.
 */
public interface AuthenticationRequestReceivedEvent extends CredentialEvent {
}
