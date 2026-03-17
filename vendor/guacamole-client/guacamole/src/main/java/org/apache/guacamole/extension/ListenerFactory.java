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

package org.apache.guacamole.extension;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.event.AuthenticationFailureEvent;
import org.apache.guacamole.net.event.AuthenticationSuccessEvent;
import org.apache.guacamole.net.event.TunnelCloseEvent;
import org.apache.guacamole.net.event.TunnelConnectEvent;
import org.apache.guacamole.net.event.listener.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A factory that reflectively instantiates Listener objects for a given
 * provider class.
 */
class ListenerFactory {

    /**
     * Creates all listeners represented by an instance of the given provider class.
     * <p>
     * If a provider class implements the simple Listener interface, that is the
     * only listener type that will be returned. Otherwise, a list of Listener
     * objects that adapt the legacy listener interfaces will be returned.
     *
     * @param providerClass
     *      A class that represents a listener.
     *
     * @return
     *      The list of listeners represented by the given provider class.
     */
    static List<Listener> createListeners(Class<?> providerClass) {

        Object provider = ProviderFactory.newInstance("listener", providerClass);

        if (provider instanceof Listener) {
            return Collections.singletonList((Listener) provider);
        }

        return createListenerAdapters(provider);

    }

    /**
     * Creates a list of adapters for the given object, based on the legacy
     * listener interfaces it implements.
     *
     * @param provider
     *      An object that implements zero or more legacy listener interfaces.
     *
     * @return
     *      The list of listeners represented by the given provider class.
     */
    @SuppressWarnings("deprecation")
    private static List<Listener> createListenerAdapters(Object provider) {

        final List<Listener> listeners = new ArrayList<Listener>();

        if (provider instanceof AuthenticationSuccessListener) {
            listeners.add(new AuthenticationSuccessListenerAdapter(
                    (AuthenticationSuccessListener) provider));
        }

        if (provider instanceof AuthenticationFailureListener) {
            listeners.add(new AuthenticationFailureListenerAdapter(
                    (AuthenticationFailureListener) provider));
        }

        if (provider instanceof TunnelConnectListener) {
            listeners.add(new TunnelConnectListenerAdapter(
                    (TunnelConnectListener) provider));
        }

        if (provider instanceof TunnelCloseListener) {
            listeners.add(new TunnelCloseListenerAdapter(
                    (TunnelCloseListener) provider));
        }

        return listeners;

    }

    /**
     * An adapter the allows an AuthenticationSuccessListener to be used
     * as an ordinary Listener.
     */
    @SuppressWarnings("deprecation")
    private static class AuthenticationSuccessListenerAdapter implements Listener {

        /**
         * The delegate listener for this adapter.
         */
        private final AuthenticationSuccessListener delegate;

        /**
         * Constructs a new adapter that delivers events to the given delegate.
         *
         * @param delegate
         *      The delegate listener.
         */
        AuthenticationSuccessListenerAdapter(AuthenticationSuccessListener delegate) {
            this.delegate = delegate;
        }

        /**
         * Handles an AuthenticationSuccessEvent by passing the event to the delegate
         * listener. If the delegate returns false, the adapter throws a GuacamoleException
         * to veto the authentication success event. All other event types are ignored.
         *
         * @param event
         *     An object that describes the event that occurred.
         *
         * @throws GuacamoleException
         *      If thrown by the delegate listener.
         */
        @Override
        public void handleEvent(Object event) throws GuacamoleException {
            if (event instanceof AuthenticationSuccessEvent) {
                if (!delegate.authenticationSucceeded((AuthenticationSuccessEvent) event)) {
                    throw new GuacamoleSecurityException(
                        "listener vetoed successful authentication");
                }
            }
        }

    }

    /**
     * An adapter the allows an AuthenticationFailureListener to be used
     * as an ordinary Listener.
     */
    @SuppressWarnings("deprecation")
    private static class AuthenticationFailureListenerAdapter implements Listener {

        /**
         * The delegate listener for this adapter.
         */
        private final AuthenticationFailureListener delegate;

        /**
         * Constructs a new adapter that delivers events to the given delegate.
         *
         * @param delegate
         *      The delegate listener.
         */
        AuthenticationFailureListenerAdapter(AuthenticationFailureListener delegate) {
            this.delegate = delegate;
        }

        /**
         * Handles an AuthenticationFailureEvent by passing the event to the delegate
         * listener. All other event types are ignored.
         *
         * @param event
         *     An object that describes the event that occurred.
         *
         * @throws GuacamoleException
         *      If thrown by the delegate listener.
         */
        @Override
        public void handleEvent(Object event) throws GuacamoleException {
            if (event instanceof AuthenticationFailureEvent) {
                delegate.authenticationFailed((AuthenticationFailureEvent) event);
            }
        }

    }

    /**
     * An adapter the allows a TunnelConnectListener to be used as an ordinary
     * Listener.
     */
    @SuppressWarnings("deprecation")
    private static class TunnelConnectListenerAdapter implements Listener {

        /**
         * The delegate listener for this adapter.
         */
        private final TunnelConnectListener delegate;

        /**
         * Constructs a new adapter that delivers events to the given delegate.
         *
         * @param delegate
         *      The delegate listener.
         */
        TunnelConnectListenerAdapter(TunnelConnectListener delegate) {
            this.delegate = delegate;
        }

        /**
         * Handles a TunnelConnectEvent by passing the event to the delegate listener.
         * If the delegate returns false, the adapter throws a GuacamoleException
         * to veto the tunnel connect event. All other event types are ignored.
         *
         * @param event
         *     An object that describes the event that occurred.
         *
         * @throws GuacamoleException
         *      If thrown by the delegate listener.
         */
        @Override
        public void handleEvent(Object event) throws GuacamoleException {
            if (event instanceof TunnelConnectEvent) {
                if (!delegate.tunnelConnected((TunnelConnectEvent) event)) {
                    throw new GuacamoleException("listener vetoed tunnel connection");
                }
            }
        }

    }

    /**
     * An adapter the allows a TunnelCloseListener to be used as an ordinary
     * Listener.
     */
    @SuppressWarnings("deprecation")
    private static class TunnelCloseListenerAdapter implements Listener {

        /**
         * The delegate listener for this adapter.
         */
        private final TunnelCloseListener delegate;

        /**
         * Constructs a new adapter that delivers events to the given delegate.
         *
         * @param delegate
         *      The delegate listener.
         */
        TunnelCloseListenerAdapter(TunnelCloseListener delegate) {
            this.delegate = delegate;
        }

        /**
         * Handles a TunnelCloseEvent by passing the event to the delegate listener.
         * If the delegate returns false, the adapter throws a GuacamoleException
         * to veto the tunnel connect event. All other event types are ignored.
         *
         * @param event
         *     An object that describes the event that occurred.
         *
         * @throws GuacamoleException
         *      If thrown by the delegate listener.
         */
        @Override
        public void handleEvent(Object event) throws GuacamoleException {
            if (event instanceof TunnelCloseEvent) {
                if (!delegate.tunnelClosed((TunnelCloseEvent) event)) {
                    throw new GuacamoleException("listener vetoed tunnel close request");
                }
            }
        }

    }

}
