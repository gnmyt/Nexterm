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

package org.apache.guacamole.auth.ban.status;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Credentials;

/**
 * AuthenticationFailureTracker implementation that does nothing. All requests
 * are ignored, regardless of status, and no tracking is performed.
 */
public class NullAuthenticationFailureTracker implements AuthenticationFailureTracker {

    @Override
    public void notifyAuthenticationRequestReceived(Credentials credentials)
            throws GuacamoleException {
        // Do nothing
    }

    @Override
    public void notifyAuthenticationSuccess(Credentials credentials)
            throws GuacamoleException {
        // Do nothing
    }

    @Override
    public void notifyAuthenticationFailed(Credentials credentials)
            throws GuacamoleException {
        // Do nothing
    }

}
