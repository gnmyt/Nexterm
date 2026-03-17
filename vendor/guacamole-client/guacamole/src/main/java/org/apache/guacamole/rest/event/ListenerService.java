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

package org.apache.guacamole.rest.event;

import java.util.List;
import javax.inject.Inject;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.event.listener.Listener;

/**
 * A service used to notify listeners registered by extensions when events of
 * interest occur.
 */
public class ListenerService implements Listener {

    /**
     * The collection of registered listeners.
     */
    @Inject
    private List<Listener> listeners;

    /**
     * Notifies registered listeners than an event has occurred. Notification continues
     * until a given listener throws a GuacamoleException or other runtime exception, or
     * until all listeners have been notified.
     *
     * @param event
     *      An object that describes the event that has occurred.
     *
     * @throws GuacamoleException
     *      If a registered listener throws a GuacamoleException.
     */
    @Override
    public void handleEvent(Object event) throws GuacamoleException {
        for (final Listener listener : listeners) {
            listener.handleEvent(event);
        }
    }

}
