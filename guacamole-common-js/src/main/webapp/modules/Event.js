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

var Guacamole = Guacamole || {};

/**
 * An arbitrary event, emitted by a {@link Guacamole.Event.Target}. This object
 * should normally serve as the base class for a different object that is more
 * specific to the event type.
 *
 * @constructor
 * @param {!string} type
 *     The unique name of this event type.
 */
Guacamole.Event = function Event(type) {

    /**
     * The unique name of this event type.
     *
     * @type {!string}
     */
    this.type = type;

    /**
     * An arbitrary timestamp in milliseconds, indicating this event's
     * position in time relative to other events.
     *
     * @type {!number}
     */
    this.timestamp = new Date().getTime();

    /**
     * Returns the number of milliseconds elapsed since this event was created.
     *
     * @return {!number}
     *     The number of milliseconds elapsed since this event was created.
     */
    this.getAge = function getAge() {
        return new Date().getTime() - this.timestamp;
    };

    /**
     * Requests that the legacy event handler associated with this event be
     * invoked on the given event target. This function will be invoked
     * automatically by implementations of {@link Guacamole.Event.Target}
     * whenever {@link Guacamole.Event.Target#emit emit()} is invoked.
     * <p>
     * Older versions of Guacamole relied on single event handlers with the
     * prefix "on", such as "onmousedown" or "onkeyup". If a Guacamole.Event
     * implementation is replacing the event previously represented by one of
     * these handlers, this function gives the implementation the opportunity
     * to provide backward compatibility with the old handler.
     * <p>
     * Unless overridden, this function does nothing.
     *
     * @param {!Guacamole.Event.Target} eventTarget
     *     The {@link Guacamole.Event.Target} that emitted this event.
     */
    this.invokeLegacyHandler = function invokeLegacyHandler(eventTarget) {
        // Do nothing
    };

};

/**
 * A {@link Guacamole.Event} that may relate to one or more DOM events.
 * Continued propagation and default behavior of the related DOM events may be
 * prevented with {@link Guacamole.Event.DOMEvent#stopPropagation stopPropagation()}
 * and {@link Guacamole.Event.DOMEvent#preventDefault preventDefault()}
 * respectively.
 *
 * @constructor
 * @augments Guacamole.Event
 *
 * @param {!string} type
 *     The unique name of this event type.
 *
 * @param {Event|Event[]} [events=[]]
 *     The DOM events that are related to this event, if any. Future calls to
 *     {@link Guacamole.Event.DOMEvent#preventDefault preventDefault()} and
 *     {@link Guacamole.Event.DOMEvent#stopPropagation stopPropagation()} will
 *     affect these events.
 */
Guacamole.Event.DOMEvent = function DOMEvent(type, events) {

    Guacamole.Event.call(this, type);

    // Default to empty array
    events = events || [];

    // Automatically wrap non-array single Event in an array
    if (!Array.isArray(events))
        events = [ events ];

    /**
     * Requests that the default behavior of related DOM events be prevented.
     * Whether this request will be honored by the browser depends on the
     * nature of those events and the timing of the request.
     */
    this.preventDefault = function preventDefault() {
        events.forEach(function applyPreventDefault(event) {
            if (event.preventDefault) event.preventDefault();
            event.returnValue = false;
        });
    };

    /**
     * Stops further propagation of related events through the DOM. Only events
     * that are directly related to this event will be stopped.
     */
    this.stopPropagation = function stopPropagation() {
        events.forEach(function applyStopPropagation(event) {
            event.stopPropagation();
        });
    };

};

/**
 * Convenience function for cancelling all further processing of a given DOM
 * event. Invoking this function prevents the default behavior of the event and
 * stops any further propagation.
 *
 * @param {!Event} event
 *     The DOM event to cancel.
 */
Guacamole.Event.DOMEvent.cancelEvent = function cancelEvent(event) {
    event.stopPropagation();
    if (event.preventDefault) event.preventDefault();
    event.returnValue = false;
};

/**
 * An object which can dispatch {@link Guacamole.Event} objects. Listeners
 * registered with {@link Guacamole.Event.Target#on on()} will automatically
 * be invoked based on the type of {@link Guacamole.Event} passed to
 * {@link Guacamole.Event.Target#dispatch dispatch()}. It is normally
 * subclasses of Guacamole.Event.Target that will dispatch events, and usages
 * of those subclasses that will catch dispatched events with on().
 *
 * @constructor
 */
Guacamole.Event.Target = function Target() {

    /**
     * A callback function which handles an event dispatched by an event
     * target.
     *
     * @callback Guacamole.Event.Target~listener
     * @param {!Guacamole.Event} event
     *     The event that was dispatched.
     *
     * @param {!Guacamole.Event.Target} target
     *     The object that dispatched the event.
     */

    /**
     * All listeners (callback functions) registered for each event type passed
     * to {@link Guacamole.Event.Targer#on on()}.
     *
     * @private
     * @type {!Object.<string, Guacamole.Event.Target~listener[]>}
     */
    var listeners = {};

    /**
     * Registers a listener for events having the given type, as dictated by
     * the {@link Guacamole.Event#type type} property of {@link Guacamole.Event}
     * provided to {@link Guacamole.Event.Target#dispatch dispatch()}.
     *
     * @param {!string} type
     *     The unique name of this event type.
     *
     * @param {!Guacamole.Event.Target~listener} listener
     *     The function to invoke when an event having the given type is
     *     dispatched. The {@link Guacamole.Event} object provided to
     *     {@link Guacamole.Event.Target#dispatch dispatch()} will be passed to
     *     this function, along with the dispatching Guacamole.Event.Target.
     */
    this.on = function on(type, listener) {

        var relevantListeners = listeners[type];
        if (!relevantListeners)
            listeners[type] = relevantListeners = [];

        relevantListeners.push(listener);

    };

    /**
     * Registers a listener for events having the given types, as dictated by
     * the {@link Guacamole.Event#type type} property of {@link Guacamole.Event}
     * provided to {@link Guacamole.Event.Target#dispatch dispatch()}.
     * <p>
     * Invoking this function is equivalent to manually invoking
     * {@link Guacamole.Event.Target#on on()} for each of the provided types.
     *
     * @param {!string[]} types
     *     The unique names of the event types to associate with the given
     *     listener.
     *
     * @param {!Guacamole.Event.Target~listener} listener
     *     The function to invoke when an event having any of the given types
     *     is dispatched. The {@link Guacamole.Event} object provided to
     *     {@link Guacamole.Event.Target#dispatch dispatch()} will be passed to
     *     this function, along with the dispatching Guacamole.Event.Target.
     */
    this.onEach = function onEach(types, listener) {
        types.forEach(function addListener(type) {
            this.on(type, listener);
        }, this);
    };

    /**
     * Dispatches the given event, invoking all event handlers registered with
     * this Guacamole.Event.Target for that event's
     * {@link Guacamole.Event#type type}.
     *
     * @param {!Guacamole.Event} event
     *     The event to dispatch.
     */
    this.dispatch = function dispatch(event) {

        // Invoke any relevant legacy handler for the event
        event.invokeLegacyHandler(this);

        // Invoke all registered listeners
        var relevantListeners = listeners[event.type];
        if (relevantListeners) {
            for (var i = 0; i < relevantListeners.length; i++) {
                relevantListeners[i](event, this);
            }
        }

    };

    /**
     * Unregisters a listener that was previously registered with
     * {@link Guacamole.Event.Target#on on()} or
     * {@link Guacamole.Event.Target#onEach onEach()}. If no such listener was
     * registered, this function has no effect. If multiple copies of the same
     * listener were registered, the first listener still registered will be
     * removed.
     *
     * @param {!string} type
     *     The unique name of the event type handled by the listener being
     *     removed.
     *
     * @param {!Guacamole.Event.Target~listener} listener
     *     The listener function previously provided to
     *     {@link Guacamole.Event.Target#on on()}or
     *     {@link Guacamole.Event.Target#onEach onEach()}.
     *
     * @returns {!boolean}
     *     true if the specified listener was removed, false otherwise.
     */
    this.off = function off(type, listener) {

        var relevantListeners = listeners[type];
        if (!relevantListeners)
            return false;

        for (var i = 0; i < relevantListeners.length; i++) {
            if (relevantListeners[i] === listener) {
                relevantListeners.splice(i, 1);
                return true;
            }
        }

        return false;

    };

    /**
     * Unregisters listeners that were previously registered with
     * {@link Guacamole.Event.Target#on on()} or
     * {@link Guacamole.Event.Target#onEach onEach()}. If no such listeners
     * were registered, this function has no effect. If multiple copies of the
     * same listener were registered for the same event type, the first
     * listener still registered will be removed.
     * <p>
     * Invoking this function is equivalent to manually invoking
     * {@link Guacamole.Event.Target#off off()} for each of the provided types.
     *
     * @param {!string[]} types
     *     The unique names of the event types handled by the listeners being
     *     removed.
     *
     * @param {!Guacamole.Event.Target~listener} listener
     *     The listener function previously provided to
     *     {@link Guacamole.Event.Target#on on()} or
     *     {@link Guacamole.Event.Target#onEach onEach()}.
     *
     * @returns {!boolean}
     *     true if any of the specified listeners were removed, false
     *     otherwise.
     */
    this.offEach = function offEach(types, listener) {

        var changed = false;

        types.forEach(function removeListener(type) {
            changed |= this.off(type, listener);
        }, this);

        return changed;

    };

};
