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

package org.apache.guacamole.auth.jdbc.tunnel;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.InetGuacamoleSocket;

/**
 * Implementation of GuacamoleSocket which connects via TCP to a given hostname
 * and port. If the socket is closed for any reason, a given task is run.
 */
public class ManagedInetGuacamoleSocket extends InetGuacamoleSocket {

    /**
     * The task to run when the socket is closed.
     */
    private final Runnable socketClosedTask;

    /**
     * Creates a new socket which connects via TCP to a given hostname and
     * port. If the socket is closed for any reason, the given task is run.
     * 
     * @param hostname
     *     The hostname of the Guacamole proxy server to connect to.
     *
     * @param port
     *     The port of the Guacamole proxy server to connect to.
     *
     * @param socketClosedTask
     *     The task to run when the socket is closed. This task will NOT be
     *     run if an exception occurs during connection, and this
     *     ManagedInetGuacamoleSocket instance is ultimately not created.
     *
     * @throws GuacamoleException
     *     If an error occurs while connecting to the Guacamole proxy server.
     */
    public ManagedInetGuacamoleSocket(String hostname, int port,
            Runnable socketClosedTask) throws GuacamoleException {
        super(hostname, port);
        this.socketClosedTask = socketClosedTask;
    }

    @Override
    public void close() throws GuacamoleException {
        super.close();
        socketClosedTask.run();
    }
    
}
