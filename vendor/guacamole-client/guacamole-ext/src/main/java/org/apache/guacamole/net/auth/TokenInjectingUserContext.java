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

import java.util.Collections;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;

/**
 * UserContext implementation which decorates a given UserContext,
 * automatically applying additional parameter tokens during the connection
 * process of any retrieved Connections and ConnectionGroups.
 */
public class TokenInjectingUserContext extends DelegatingUserContext {

    /**
     * The additional tokens to include with each call to connect() if
     * getTokens() or addTokens() are not overridden.
     */
    private final Map<String, String> tokens;

    /**
     * Wraps the given UserContext, overriding the connect() function of each
     * retrieved Connection and ConnectionGroup such that the given additional
     * parameter tokens are included. Any additional tokens which have the same
     * name as existing tokens will override the existing values. If tokens
     * specific to a particular connection or connection group need to be
     * included, getTokens() or addTokens() may be overridden to provide a
     * different set of tokens.
     *
     * @param userContext
     *     The UserContext to wrap.
     *
     * @param tokens
     *     The additional tokens to include with each call to connect().
     */
    public TokenInjectingUserContext(UserContext userContext,
            Map<String, String> tokens) {
        super(userContext);
        this.tokens = tokens;
    }

    /**
     * Wraps the given UserContext, overriding the connect() function of each
     * retrieved Connection and ConnectionGroup such that the additional
     * parameter tokens added by addTokens() or returned by getTokens() are
     * included. Any additional tokens which have the same name as existing
     * tokens will override the existing values.
     *
     * @param userContext
     *     The UserContext to wrap.
     */
    public TokenInjectingUserContext(UserContext userContext) {
        this(userContext, Collections.<String, String>emptyMap());
    }

    /**
     * Returns the tokens which should be added to an in-progress call to
     * connect() for the given Connection. If not overridden, this function
     * will return the tokens provided when this instance of
     * TokenInjectingUserContext was created. If the values of existing tokens
     * need to be considered, implementations should override
     * {@link #addTokens(org.apache.guacamole.net.auth.Connection, java.util.Map)}
     * instead.
     *
     * @param connection
     *     The Connection on which connect() has been called.
     *
     * @return
     *     The tokens which should be added to the in-progress call to
     *     connect().
     *
     * @throws GuacamoleException
     *     If the tokens applicable to the given connection cannot be
     *     generated.
     */
    protected Map<String, String> getTokens(Connection connection)
            throws GuacamoleException {
        return tokens;
    }

    /**
     * Adds tokens to an in-progress call to connect() for the given
     * Connection. If not overridden, this function will add the tokens
     * returned by {@link #getTokens(org.apache.guacamole.net.auth.Connection)}.
     *
     * @param connection
     *     The Connection on which connect() has been called.
     *
     * @param tokens
     *     A modifiable Map containing the tokens already supplied to
     *     connect().
     *
     * @throws GuacamoleException
     *     If the tokens applicable to the given connection cannot be
     *     generated.
     */
    protected void addTokens(Connection connection, Map<String, String> tokens)
            throws GuacamoleException {
        tokens.putAll(getTokens(connection));
    }

    /**
     * Returns the tokens which should be added to an in-progress call to
     * connect() for the given ConnectionGroup. If not overridden, this
     * function will return the tokens provided when this instance of
     * TokenInjectingUserContext was created. If the values of existing tokens
     * need to be considered, implementations should override
     * {@link #addTokens(org.apache.guacamole.net.auth.ConnectionGroup, java.util.Map)}
     * instead.
     *
     * @param connectionGroup
     *     The ConnectionGroup on which connect() has been called.
     *
     * @return
     *     The tokens which should be added to the in-progress call to
     *     connect().
     *
     * @throws GuacamoleException
     *     If the tokens applicable to the given connection group cannot be
     *     generated.
     */
    protected Map<String, String> getTokens(ConnectionGroup connectionGroup)
            throws GuacamoleException {
        return tokens;
    }

    /**
     * Adds tokens to an in-progress call to connect() for the given
     * ConnectionGroup. If not overridden, this function will add the tokens
     * returned by {@link #getTokens(org.apache.guacamole.net.auth.ConnectionGroup)}.
     *
     * @param connectionGroup
     *     The ConnectionGroup on which connect() has been called.
     *
     * @param tokens
     *     A modifiable Map containing the tokens already supplied to
     *     connect().
     *
     * @throws GuacamoleException
     *     If the tokens applicable to the given connection cannot be
     *     generated.
     */
    protected void addTokens(ConnectionGroup connectionGroup,
            Map<String, String> tokens) throws GuacamoleException {
        tokens.putAll(getTokens(connectionGroup));
    }

    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory()
            throws GuacamoleException {
        return new DecoratingDirectory<ConnectionGroup>(super.getConnectionGroupDirectory()) {

            @Override
            protected ConnectionGroup decorate(ConnectionGroup object) throws GuacamoleException {
                return new TokenInjectingConnectionGroup(object) {

                    @Override
                    protected void addTokens(Map<String, String> tokens) throws GuacamoleException {
                        TokenInjectingUserContext.this.addTokens(object, tokens);
                    }

                };
            }

            @Override
            protected ConnectionGroup undecorate(ConnectionGroup object) throws GuacamoleException {
                return ((TokenInjectingConnectionGroup) object).getDelegateConnectionGroup();
            }

        };
    }

    @Override
    public Directory<Connection> getConnectionDirectory()
            throws GuacamoleException {
        return new DecoratingDirectory<Connection>(super.getConnectionDirectory()) {

            @Override
            protected Connection decorate(Connection object) throws GuacamoleException {
                return new TokenInjectingConnection(object) {

                    @Override
                    protected void addTokens(Map<String, String> tokens) throws GuacamoleException {
                        TokenInjectingUserContext.this.addTokens(object, tokens);
                    }

                };
            }

            @Override
            protected Connection undecorate(Connection object) throws GuacamoleException {
                return ((TokenInjectingConnection) object).getDelegateConnection();
            }

        };
    }

}
