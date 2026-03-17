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

package org.apache.guacamole.io;


import java.io.IOException;
import java.io.Writer;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import org.apache.guacamole.GuacamoleConnectionClosedException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.GuacamoleUpstreamTimeoutException;
import org.apache.guacamole.protocol.GuacamoleInstruction;

/**
 * A GuacamoleWriter which wraps a standard Java Writer, using that Writer as
 * the Guacamole instruction stream.
 */
public class WriterGuacamoleWriter implements GuacamoleWriter {

    /**
     * Wrapped Writer to be used for all output.
     */
    private Writer output;

    /**
     * Creates a new WriterGuacamoleWriter which will use the given Writer as
     * the Guacamole instruction stream.
     *
     * @param output The Writer to use as the Guacamole instruction stream.
     */
    public WriterGuacamoleWriter(Writer output) {
        this.output = output;
    }

    @Override
    public void write(char[] chunk, int off, int len) throws GuacamoleException {
        try {
            output.write(chunk, off, len);
            output.flush();
        }
        catch (SocketTimeoutException e) {
            throw new GuacamoleUpstreamTimeoutException("Connection to guacd timed out.", e);
        }
        catch (SocketException e) {
            throw new GuacamoleConnectionClosedException("Connection to guacd is closed.", e);
        }
        catch (IOException e) {
            throw new GuacamoleServerException(e);
        }
    }

    @Override
    public void write(char[] chunk) throws GuacamoleException {
        write(chunk, 0, chunk.length);
    }

    @Override
    public void writeInstruction(GuacamoleInstruction instruction) throws GuacamoleException {
        write(instruction.toString().toCharArray());
    }

}
