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

package org.apache.guacamole.history.user;

import java.util.Collections;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.history.HistoryAuthenticationProvider;
import org.apache.guacamole.history.connection.HistoryConnection;
import org.apache.guacamole.history.connection.RecordedConnectionActivityRecordSet;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.DecoratingDirectory;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.TokenInjectingUserContext;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;

/**
 * UserContext implementation that automatically defines ActivityLogs for
 * files that relate to history entries.
 */
public class HistoryUserContext extends TokenInjectingUserContext {

    /**
     * The name of the parameter token that contains the automatically-searched
     * history recording/log path.
     */
    private static final String HISTORY_PATH_TOKEN_NAME = "HISTORY_PATH";
    
    /**
     * The current Guacamole user.
     */
    private final User currentUser;

    /**
     * Creates a new HistoryUserContext that wraps the given UserContext,
     * automatically associating history entries with ActivityLogs based on
     * related files (session recordings, typescripts, etc.).
     *
     * @param currentUser
     *     The current Guacamole user.
     *
     * @param context
     *     The UserContext to wrap.
     */
    public HistoryUserContext(User currentUser, UserContext context) {
        super(context);
        this.currentUser = currentUser;
    }

    /**
     * Returns the tokens which should be added to an in-progress call to
     * connect() for any Connectable object.
     *
     * @return
     *     The tokens which should be added to the in-progress call to
     *     connect().
     *
     * @throws GuacamoleException
     *     If the relevant tokens cannot be generated.
     */
    private Map<String, String> getTokens() throws GuacamoleException {
        return Collections.singletonMap(HISTORY_PATH_TOKEN_NAME,
                HistoryAuthenticationProvider.getRecordingSearchPath().getAbsolutePath());
    }
    
    @Override
    protected Map<String, String> getTokens(ConnectionGroup connectionGroup)
            throws GuacamoleException {
        return getTokens();
    }

    @Override
    protected Map<String, String> getTokens(Connection connection)
            throws GuacamoleException {
        return getTokens();
    }

    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {
        return new DecoratingDirectory<Connection>(super.getConnectionDirectory()) {

            @Override
            protected Connection decorate(Connection object) {
                return new HistoryConnection(currentUser, object);
            }

            @Override
            protected Connection undecorate(Connection object) throws GuacamoleException {
                return ((HistoryConnection) object).getWrappedConnection();
            }

        };
    }

    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        return new RecordedConnectionActivityRecordSet(currentUser, super.getConnectionHistory());
    }

}
