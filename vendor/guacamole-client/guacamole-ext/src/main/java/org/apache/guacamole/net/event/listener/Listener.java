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
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 */

package org.apache.guacamole.net.event.listener;

import org.apache.guacamole.GuacamoleException;

/**
 * A listener for events that occur in handing various Guacamole requests
 * such as authentication, tunnel connect/close, etc. Listeners are registered
 * through the extension manifest mechanism. When an event occurs, listeners
 * are notified in the order in which they are declared in the manifest and
 * continues until either all listeners have been notified or with the first
 * listener that throws a GuacamoleException or other runtime exception.
 */
public interface Listener {

    /**
     * Notifies the recipient that an event has occurred.
     * <p>
     * Throwing an exception from an event listener can act to veto an action in
     * progress for some event types. See the Javadoc for specific event types for
     * details.
     *
     * @param event
     *     An object that describes the event that has occurred.
     *
     * @throws GuacamoleException
     *     If the listener wishes to stop notification of the event to subsequent
     *     listeners. For some event types, this acts to veto an action in progress;
     *     e.g. treating a successful authentication as though it failed.
     */
    void handleEvent(Object event) throws GuacamoleException;

}
