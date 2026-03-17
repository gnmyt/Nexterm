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

import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.event.listener.Listener;

/**
 * Event that is dispatched when the web application has nearly completely shut
 * down, including the authentication/authorization portion of extensions. Any
 * installed extensions are still loaded (such that they may receive this event
 * via {@link Listener#handleEvent(java.lang.Object)}, but their authentication
 * providers will have been shut down via {@link AuthenticationProvider#shutdown()},
 * and resources from user sessions will have been closed and released via
 * {@link UserContext#invalidate()}.
 */
public interface ApplicationShutdownEvent {
}
