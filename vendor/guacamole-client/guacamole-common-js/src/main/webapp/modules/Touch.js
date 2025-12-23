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
 * Provides cross-browser multi-touch events for a given element. The events of
 * the given element are automatically populated with handlers that translate
 * touch events into a non-browser-specific event provided by the
 * Guacamole.Touch instance.
 * 
 * @constructor
 * @augments Guacamole.Event.Target
 * @param {!Element} element
 *     The Element to use to provide touch events.
 */
Guacamole.Touch = function Touch(element) {

    Guacamole.Event.Target.call(this);

    /**
     * Reference to this Guacamole.Touch.
     *
     * @private
     * @type {!Guacamole.Touch}
     */
    var guacTouch = this;

    /**
     * The default X/Y radius of each touch if the device or browser does not
     * expose the size of the contact area.
     *
     * @private
     * @constant
     * @type {!number}
     */
    var DEFAULT_CONTACT_RADIUS = Math.floor(16 * window.devicePixelRatio);

    /**
     * The set of all active touches, stored by their unique identifiers.
     *
     * @type {!Object.<Number, Guacamole.Touch.State>}
     */
    this.touches = {};

    /**
     * The number of active touches currently stored within
     * {@link Guacamole.Touch#touches touches}.
     */
    this.activeTouches = 0;

    /**
     * Fired whenever a new touch contact is initiated on the element
     * associated with this Guacamole.Touch.
     * 
     * @event Guacamole.Touch#touchstart
     * @param {!Guacamole.Touch.Event} event
     *     A {@link Guacamole.Touch.Event} object representing the "touchstart"
     *     event.
     */

    /**
     * Fired whenever an established touch contact moves within the element
     * associated with this Guacamole.Touch.
     * 
     * @event Guacamole.Touch#touchmove
     * @param {!Guacamole.Touch.Event} event
     *     A {@link Guacamole.Touch.Event} object representing the "touchmove"
     *     event.
     */

    /**
     * Fired whenever an established touch contact is lifted from the element
     * associated with this Guacamole.Touch.
     * 
     * @event Guacamole.Touch#touchend
     * @param {!Guacamole.Touch.Event} event
     *     A {@link Guacamole.Touch.Event} object representing the "touchend"
     *     event.
     */

    element.addEventListener('touchstart', function touchstart(e) {

        // Fire "ontouchstart" events for all new touches
        for (var i = 0; i < e.changedTouches.length; i++) {

            var changedTouch = e.changedTouches[i];
            var identifier = changedTouch.identifier;

            // Ignore duplicated touches
            if (guacTouch.touches[identifier])
                continue;

            var touch = guacTouch.touches[identifier] = new Guacamole.Touch.State({
                id      : identifier,
                radiusX : changedTouch.radiusX || DEFAULT_CONTACT_RADIUS,
                radiusY : changedTouch.radiusY || DEFAULT_CONTACT_RADIUS,
                angle   : changedTouch.angle || 0.0,
                force   : changedTouch.force || 1.0 /* Within JavaScript changedTouch events, a force of 0.0 indicates the device does not support reporting changedTouch force */
            });

            guacTouch.activeTouches++;

            touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
            guacTouch.dispatch(new Guacamole.Touch.Event('touchmove', e, touch));

        }

    }, false);

    element.addEventListener('touchmove', function touchstart(e) {

        // Fire "ontouchmove" events for all updated touches
        for (var i = 0; i < e.changedTouches.length; i++) {

            var changedTouch = e.changedTouches[i];
            var identifier = changedTouch.identifier;

            // Ignore any unrecognized touches
            var touch = guacTouch.touches[identifier];
            if (!touch)
                continue;

            // Update force only if supported by browser (otherwise, assume
            // force is unchanged)
            if (changedTouch.force)
                touch.force = changedTouch.force;

            // Update touch area, if supported by browser and device
            touch.angle = changedTouch.angle || 0.0;
            touch.radiusX = changedTouch.radiusX || DEFAULT_CONTACT_RADIUS;
            touch.radiusY = changedTouch.radiusY || DEFAULT_CONTACT_RADIUS;

            // Update with any change in position
            touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
            guacTouch.dispatch(new Guacamole.Touch.Event('touchmove', e, touch));

        }

    }, false);

    element.addEventListener('touchend', function touchstart(e) {

        // Fire "ontouchend" events for all updated touches
        for (var i = 0; i < e.changedTouches.length; i++) {

            var changedTouch = e.changedTouches[i];
            var identifier = changedTouch.identifier;

            // Ignore any unrecognized touches
            var touch = guacTouch.touches[identifier];
            if (!touch)
                continue;

            // Stop tracking this particular touch
            delete guacTouch.touches[identifier];
            guacTouch.activeTouches--;

            // Touch has ended
            touch.force = 0.0;

            // Update with final position
            touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
            guacTouch.dispatch(new Guacamole.Touch.Event('touchend', e, touch));

        }

    }, false);

};

/**
 * The current state of a touch contact.
 *
 * @constructor
 * @augments Guacamole.Position
 * @param {Guacamole.Touch.State|object} [template={}]
 *     The object whose properties should be copied within the new
 *     Guacamole.Touch.State.
 */
Guacamole.Touch.State = function State(template) {

    template = template || {};

    Guacamole.Position.call(this, template);

    /**
     * An arbitrary integer ID which uniquely identifies this contact relative
     * to other active contacts.
     *
     * @type {!number}
     * @default 0
     */
    this.id = template.id || 0;

    /**
     * The Y radius of the ellipse covering the general area of the touch
     * contact, in pixels.
     *
     * @type {!number}
     * @default 0
     */
    this.radiusX = template.radiusX || 0;

    /**
     * The X radius of the ellipse covering the general area of the touch
     * contact, in pixels.
     *
     * @type {!number}
     * @default 0
     */
    this.radiusY = template.radiusY || 0;

    /**
     * The rough angle of clockwise rotation of the general area of the touch
     * contact, in degrees.
     *
     * @type {!number}
     * @default 0.0
     */
    this.angle = template.angle || 0.0;

    /**
     * The relative force exerted by the touch contact, where 0 is no force
     * (the touch has been lifted) and 1 is maximum force (the maximum amount
     * of force representable by the device).
     *
     * @type {!number}
     * @default 1.0
     */
    this.force = template.force || 1.0;

};

/**
 * An event which represents a change in state of a single touch contact,
 * including the creation or removal of that contact. If multiple contacts are
 * involved in a touch interaction, each contact will be associated with its
 * own event.
 *
 * @constructor
 * @augments Guacamole.Event.DOMEvent
 * @param {!string} type
 *     The name of the touch event type. Possible values are "touchstart",
 *     "touchmove", and "touchend".
 *
 * @param {!TouchEvent} event
 *     The DOM touch event that produced this Guacamole.Touch.Event.
 *
 * @param {!Guacamole.Touch.State} state
 *     The state of the touch contact associated with this event.
 */
Guacamole.Touch.Event = function TouchEvent(type, event, state) {

    Guacamole.Event.DOMEvent.call(this, type, [ event ]);

    /**
     * The state of the touch contact associated with this event.
     *
     * @type {!Guacamole.Touch.State}
     */
    this.state = state;

};
