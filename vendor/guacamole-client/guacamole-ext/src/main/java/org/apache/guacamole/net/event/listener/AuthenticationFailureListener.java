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
import org.apache.guacamole.net.event.AuthenticationFailureEvent;

/**
 * A listener whose authenticationFailed() hook will fire immediately
 * after a user's authentication attempt fails. Note that this hook cannot
 * be used to cancel the authentication failure.
 *
 * @deprecated
 *      Listeners should instead implement the {@link Listener} interface.
 */
@Deprecated
public interface AuthenticationFailureListener {

    /**
     * Event hook which fires immediately after a user's authentication attempt
     * fails.
     *
     * @param e
     *      The AuthenticationFailureEvent describing the authentication
     *      failure that just occurred.
     *
     * @throws GuacamoleException
     *      If an error occurs while handling the authentication failure event.
     *      Note that throwing an exception will NOT cause the authentication
     *      failure to be canceled (which makes no sense), but it will prevent
     *      subsequent listeners from receiving the notification.
     */
    void authenticationFailed(AuthenticationFailureEvent e)
            throws GuacamoleException;

}
