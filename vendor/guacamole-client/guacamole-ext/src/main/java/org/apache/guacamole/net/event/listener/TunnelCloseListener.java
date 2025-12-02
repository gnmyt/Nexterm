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
import org.apache.guacamole.net.event.TunnelCloseEvent;

/**
 * A listener whose tunnelClosed() hook will fire immediately before an
 * existing tunnel is closed.
 *
 * @deprecated
 *      Listeners should instead implement the {@link Listener} interface.
 */
@Deprecated
public interface TunnelCloseListener {

    /**
     * Event hook which fires immediately before an existing tunnel is closed.
     * The return value of this hook dictates whether the tunnel is allowed to
     * be closed.
     *
     * @param e
     *      The TunnelCloseEvent describing the tunnel being closed and
     *      any associated credentials.
     *
     * @return
     *      true if the tunnel should be allowed to be closed, or false
     *      if the attempt should be denied, causing the attempt to
     *      effectively fail.
     *
     * @throws GuacamoleException
     *      If an error occurs while handling the tunnel close event. Throwing
     *      an exception will also stop the tunnel from being closed.
     */
    boolean tunnelClosed(TunnelCloseEvent e) throws GuacamoleException;

}
