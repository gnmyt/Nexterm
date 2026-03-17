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
import org.apache.guacamole.net.event.TunnelConnectEvent;

/**
 * A listener whose tunnelConnected() hook will fire immediately after a new
 * tunnel is connected.
 *
 * @deprecated
 *      Listeners should instead implement the {@link Listener} interface.
 */
@Deprecated
public interface TunnelConnectListener {

   /**
    * Event hook which fires immediately after a new tunnel is connected.
    * The return value of this hook dictates whether the tunnel is made visible
    * to the session.
    *
    * @param e
    *      The TunnelConnectEvent describing the tunnel being connected and
    *      any associated credentials.
    *
    * @return
    *      true if the tunnel should be allowed to be connected, or false
    *      if the attempt should be denied, causing the attempt to
    *      effectively fail.
    *
    * @throws GuacamoleException
    *       If an error occurs while handling the tunnel connect event. Throwing
    *       an exception will also stop the tunnel from being made visible to the
    *       session.
    */
    boolean tunnelConnected(TunnelConnectEvent e) throws GuacamoleException;

}
