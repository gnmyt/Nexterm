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

package org.apache.guacamole.net.auth;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.language.TranslatableMessage;

/**
 * ActivityLog implementation that exposes the content of a local file.
 */
public class FileActivityLog extends AbstractActivityLog {

    /**
     * The File providing the content of this log.
     */
    private final File content;

    /**
     * Creates a new FileActivityLog that exposes the content of the given
     * local file as an {@link ActivityLog}.
     *
     * @param type
     *     The type of this ActivityLog.
     *
     * @param description
     *     A human-readable message that describes this log.
     *
     * @param content
     *     The File that should be used to provide the content of this log.
     */
    public FileActivityLog(Type type, TranslatableMessage description, File content) {
        super(type, description);
        this.content = content;
    }

    @Override
    public long getSize() throws GuacamoleException {
        return content.length();
    }

    @Override
    public InputStream getContent() throws GuacamoleException {
        try {
            return new FileInputStream(content);
        }
        catch (FileNotFoundException e) {
            throw new GuacamoleResourceNotFoundException("Associated file "
                    + "does not exist or cannot be read.", e);
        }
    }

}
