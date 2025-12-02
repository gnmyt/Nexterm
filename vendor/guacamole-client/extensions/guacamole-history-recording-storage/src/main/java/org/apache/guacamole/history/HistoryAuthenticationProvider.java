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

package org.apache.guacamole.history;

import java.io.File;
import org.apache.guacamole.history.user.HistoryUserContext;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.properties.FileGuacamoleProperty;

/**
 * AuthenticationProvider implementation which automatically associates history
 * entries with session recordings, typescripts, etc. History association is
 * determined by matching the history entry UUID with the filenames of files
 * located within a standardized/configurable directory.
 */
public class HistoryAuthenticationProvider extends AbstractAuthenticationProvider {

    /**
     * The default directory to search for associated session recordings, if
     * not overridden with the "recording-search-path" property.
     */
    private static final File DEFAULT_RECORDING_SEARCH_PATH = new File("/var/lib/guacamole/recordings");

    /**
     * The directory to search for associated session recordings. By default,
     * "/var/lib/guacamole/recordings" will be used.
     */
    private static final FileGuacamoleProperty RECORDING_SEARCH_PATH = new FileGuacamoleProperty() {

        @Override
        public String getName() {
            return "recording-search-path";
        }

    };

    /**
     * Returns the directory that should be searched for session recordings
     * associated with history entries.
     *
     * @return
     *     The directory that should be searched for session recordings
     *     associated with history entries.
     *
     * @throws GuacamoleException
     *     If the "recording-search-path" property cannot be parsed.
     */
    public static File getRecordingSearchPath() throws GuacamoleException {
        Environment environment = LocalEnvironment.getInstance();
        return environment.getProperty(RECORDING_SEARCH_PATH,
                DEFAULT_RECORDING_SEARCH_PATH);
    }
    
    @Override
    public String getIdentifier() {
        return "recording-storage";
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {
        return new HistoryUserContext(context.self(), context);
    }

}
