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

package org.apache.guacamole.net.event.listener;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.event.AuthenticationSuccessEvent;

/**
 * A listener whose hooks will fire immediately before and after a user's
 * authentication attempt succeeds. If a user successfully authenticates,
 * the authenticationSucceeded() hook has the opportunity to cancel the
 * authentication and force it to fail.
 *
 * @deprecated
 *      Listeners should instead implement the {@link Listener} interface.
 */
@Deprecated
public interface AuthenticationSuccessListener {

    /**
     * Event hook which fires immediately after a user's authentication attempt
     * succeeds. The return value of this hook dictates whether the
     * successful authentication attempt is canceled.
     *
     * @param e
     *      The AuthenticationFailureEvent describing the authentication
     *      failure that just occurred.
     *
     * @return
     *      true if the successful authentication attempt should be
     *      allowed, or false if the attempt should be denied, causing
     *      the attempt to effectively fail.
     *
     * @throws GuacamoleException
     *      If an error occurs while handling the authentication success event.
     *      Throwing an exception will also cancel the authentication success.
     */
    boolean authenticationSucceeded(AuthenticationSuccessEvent e)
            throws GuacamoleException;

}
