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
 * Provides cross-browser mouse events for a given element. The events of
 * the given element are automatically populated with handlers that translate
 * mouse events into a non-browser-specific event provided by the
 * Guacamole.Mouse instance.
 *
 * @example
 * var mouse = new Guacamole.Mouse(client.getDisplay().getElement());
 *
 * // Forward all mouse interaction over Guacamole connection
 * mouse.onEach(['mousedown', 'mousemove', 'mouseup'], function sendMouseEvent(e) {
 *     client.sendMouseState(e.state, true);
 * });
 *
 * @example
 * // Hide software cursor when mouse leaves display
 * mouse.on('mouseout', function hideCursor() {
 *     client.getDisplay().showCursor(false);
 * });
 *
 * @constructor
 * @augments Guacamole.Mouse.Event.Target
 * @param {!Element} element
 *     The Element to use to provide mouse events.
 */
Guacamole.Mouse = function Mouse(element) {

    Guacamole.Mouse.Event.Target.call(this);

    /**
     * Reference to this Guacamole.Mouse.
     *
     * @private
     * @type {!Guacamole.Mouse}
     */
    var guac_mouse = this;

    /**
     * The number of mousemove events to require before re-enabling mouse
     * event handling after receiving a touch event.
     *
     * @type {!number}
     */
    this.touchMouseThreshold = 3;

    /**
     * The minimum amount of pixels scrolled required for a single scroll button
     * click.
     *
     * @type {!number}
     */
    this.scrollThreshold = 53;

    /**
     * The number of pixels to scroll per line.
     *
     * @type {!number}
     */
    this.PIXELS_PER_LINE = 18;

    /**
     * The number of pixels to scroll per page.
     *
     * @type {!number}
     */
    this.PIXELS_PER_PAGE = this.PIXELS_PER_LINE * 16;

    /**
     * Array of {@link Guacamole.Mouse.State} button names corresponding to the
     * mouse button indices used by DOM mouse events.
     *
     * @private
     * @type {!string[]}
     */
    var MOUSE_BUTTONS = [
        Guacamole.Mouse.State.Buttons.LEFT,
        Guacamole.Mouse.State.Buttons.MIDDLE,
        Guacamole.Mouse.State.Buttons.RIGHT
    ];

    /**
     * Counter of mouse events to ignore. This decremented by mousemove, and
     * while non-zero, mouse events will have no effect.
     *
     * @private
     * @type {!number}
     */
    var ignore_mouse = 0;

    /**
     * Cumulative scroll delta amount. This value is accumulated through scroll
     * events and results in scroll button clicks if it exceeds a certain
     * threshold.
     *
     * @private
     * @type {!number}
     */
    var scroll_delta = 0;

    // Block context menu so right-click gets sent properly
    element.addEventListener("contextmenu", function(e) {
        Guacamole.Event.DOMEvent.cancelEvent(e);
    }, false);

    element.addEventListener("mousemove", function(e) {

        // If ignoring events, decrement counter
        if (ignore_mouse) {
            Guacamole.Event.DOMEvent.cancelEvent(e);
            ignore_mouse--;
            return;
        }

        guac_mouse.move(Guacamole.Position.fromClientPosition(element, e.clientX, e.clientY), e);

    }, false);

    element.addEventListener("mousedown", function(e) {

        // Do not handle if ignoring events
        if (ignore_mouse) {
            Guacamole.Event.DOMEvent.cancelEvent(e);
            return;
        }

        var button = MOUSE_BUTTONS[e.button];
        if (button)
            guac_mouse.press(button, e);

    }, false);

    element.addEventListener("mouseup", function(e) {

        // Do not handle if ignoring events
        if (ignore_mouse) {
            Guacamole.Event.DOMEvent.cancelEvent(e);
            return;
        }

        var button = MOUSE_BUTTONS[e.button];
        if (button)
            guac_mouse.release(button, e);

    }, false);

    element.addEventListener("mouseout", function(e) {

        // Get parent of the element the mouse pointer is leaving
       	if (!e) e = window.event;

        // Check that mouseout is due to actually LEAVING the element
        var target = e.relatedTarget || e.toElement;
        while (target) {
            if (target === element)
                return;
            target = target.parentNode;
        }

        // Release all buttons and fire mouseout
        guac_mouse.reset(e);
        guac_mouse.out(e);

    }, false);

    // Override selection on mouse event element.
    element.addEventListener("selectstart", function(e) {
        Guacamole.Event.DOMEvent.cancelEvent(e);
    }, false);

    // Ignore all pending mouse events when touch events are the apparent source
    function ignorePendingMouseEvents() { ignore_mouse = guac_mouse.touchMouseThreshold; }

    element.addEventListener("touchmove",  ignorePendingMouseEvents, false);
    element.addEventListener("touchstart", ignorePendingMouseEvents, false);
    element.addEventListener("touchend",   ignorePendingMouseEvents, false);

    // Scroll wheel support
    function mousewheel_handler(e) {

        // Determine approximate scroll amount (in pixels)
        var delta = e.deltaY || -e.wheelDeltaY || -e.wheelDelta;

        // If successfully retrieved scroll amount, convert to pixels if not
        // already in pixels
        if (delta) {

            // Convert to pixels if delta was lines
            if (e.deltaMode === 1)
                delta = e.deltaY * guac_mouse.PIXELS_PER_LINE;

            // Convert to pixels if delta was pages
            else if (e.deltaMode === 2)
                delta = e.deltaY * guac_mouse.PIXELS_PER_PAGE;

        }

        // Otherwise, assume legacy mousewheel event and line scrolling
        else
            delta = e.detail * guac_mouse.PIXELS_PER_LINE;
        
        // Update overall delta
        scroll_delta += delta;

        // Up
        if (scroll_delta <= -guac_mouse.scrollThreshold) {

            // Repeatedly click the up button until insufficient delta remains
            do {
                guac_mouse.click(Guacamole.Mouse.State.Buttons.UP);
                scroll_delta += guac_mouse.scrollThreshold;
            } while (scroll_delta <= -guac_mouse.scrollThreshold);

            // Reset delta
            scroll_delta = 0;

        }

        // Down
        if (scroll_delta >= guac_mouse.scrollThreshold) {

            // Repeatedly click the down button until insufficient delta remains
            do {
                guac_mouse.click(Guacamole.Mouse.State.Buttons.DOWN);
                scroll_delta -= guac_mouse.scrollThreshold;
            } while (scroll_delta >= guac_mouse.scrollThreshold);

            // Reset delta
            scroll_delta = 0;

        }

        // All scroll/wheel events must currently be cancelled regardless of
        // whether the dispatched event is cancelled, as there is no Guacamole
        // scroll event and thus no way to cancel scroll events that are
        // smaller than required to produce an up/down click
        Guacamole.Event.DOMEvent.cancelEvent(e);

    }

    if (window.WheelEvent) {
        // All modern browsers support wheel events.
        element.addEventListener('wheel', mousewheel_handler, false);
    }
    else {
        // Legacy FireFox wheel events.
        element.addEventListener('DOMMouseScroll', mousewheel_handler, false);
        // Legacy Chrome/IE/other wheel events.
        element.addEventListener('mousewheel', mousewheel_handler, false);
    }

    /**
     * Whether the browser supports CSS3 cursor styling, including hotspot
     * coordinates.
     *
     * @private
     * @type {!boolean}
     */
    var CSS3_CURSOR_SUPPORTED = (function() {

        var div = document.createElement("div");

        // If no cursor property at all, then no support
        if (!("cursor" in div.style))
            return false;

        try {
            // Apply simple 1x1 PNG
            div.style.cursor = "url(data:image/png;base64,"
                             + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
                             + "AQMAAAAl21bKAAAAA1BMVEX///+nxBvI"
                             + "AAAACklEQVQI12NgAAAAAgAB4iG8MwAA"
                             + "AABJRU5ErkJggg==) 0 0, auto";
        }
        catch (e) {
            return false;
        }

        // Verify cursor property is set to URL with hotspot
        return /\burl\([^()]*\)\s+0\s+0\b/.test(div.style.cursor || "");

    })();

    /**
     * Changes the local mouse cursor to the given canvas, having the given
     * hotspot coordinates. This affects styling of the element backing this
     * Guacamole.Mouse only, and may fail depending on browser support for
     * setting the mouse cursor.
     * 
     * If setting the local cursor is desired, it is up to the implementation
     * to do something else, such as use the software cursor built into
     * Guacamole.Display, if the local cursor cannot be set.
     *
     * @param {!HTMLCanvasElement} canvas
     *     The cursor image.
     *
     * @param {!number} x
     *     The X-coordinate of the cursor hotspot.
     *
     * @param {!number} y
     *     The Y-coordinate of the cursor hotspot.
     *
     * @return {!boolean}
     *     true if the cursor was successfully set, false if the cursor could
     *     not be set for any reason.
     */
    this.setCursor = function(canvas, x, y) {

        // Attempt to set via CSS3 cursor styling
        if (CSS3_CURSOR_SUPPORTED) {
            var dataURL = canvas.toDataURL('image/png');
            element.style.cursor = "url(" + dataURL + ") " + x + " " + y + ", auto";
            return true;
        }

        // Otherwise, setting cursor failed
        return false;

    };

};

/**
 * The current state of a mouse, including position and buttons.
 *
 * @constructor
 * @augments Guacamole.Position
 * @param {Guacamole.Mouse.State|object} [template={}]
 *     The object whose properties should be copied within the new
 *     Guacamole.Mouse.State.
 */
Guacamole.Mouse.State = function State(template) {

    /**
     * Returns the template object that would be provided to the
     * Guacamole.Mouse.State constructor to produce a new Guacamole.Mouse.State
     * object with the properties specified. The order and type of arguments
     * used by this function are identical to those accepted by the
     * Guacamole.Mouse.State constructor of Apache Guacamole 1.3.0 and older.
     *
     * @private
     * @param {!number} x
     *     The X position of the mouse pointer in pixels.
     *
     * @param {!number} y
     *     The Y position of the mouse pointer in pixels.
     *
     * @param {!boolean} left
     *     Whether the left mouse button is pressed.
     *
     * @param {!boolean} middle
     *     Whether the middle mouse button is pressed.
     *
     * @param {!boolean} right
     *     Whether the right mouse button is pressed.
     *
     * @param {!boolean} up
     *     Whether the up mouse button is pressed (the fourth button, usually
     *     part of a scroll wheel).
     *
     * @param {!boolean} down
     *     Whether the down mouse button is pressed (the fifth button, usually
     *     part of a scroll wheel).
     *
     * @return {!object}
     *     The equivalent template object that would be passed to the new
     *     Guacamole.Mouse.State constructor.
     */
    var legacyConstructor = function legacyConstructor(x, y, left, middle, right, up, down) {
        return {
            x      : x,
            y      : y,
            left   : left,
            middle : middle,
            right  : right,
            up     : up,
            down   : down
        };
    };

    // Accept old-style constructor, as well
    if (arguments.length > 1)
        template = legacyConstructor.apply(this, arguments);
    else
        template = template || {};

    Guacamole.Position.call(this, template);

    /**
     * Whether the left mouse button is currently pressed.
     *
     * @type {!boolean}
     * @default false
     */
    this.left = template.left || false;

    /**
     * Whether the middle mouse button is currently pressed.
     *
     * @type {!boolean}
     * @default false
     */
    this.middle = template.middle || false;

    /**
     * Whether the right mouse button is currently pressed.
     *
     * @type {!boolean}
     * @default false
     */
    this.right = template.right || false;

    /**
     * Whether the up mouse button is currently pressed. This is the fourth
     * mouse button, associated with upward scrolling of the mouse scroll
     * wheel.
     *
     * @type {!boolean}
     * @default false
     */
    this.up = template.up || false;

    /**
     * Whether the down mouse button is currently pressed. This is the fifth 
     * mouse button, associated with downward scrolling of the mouse scroll
     * wheel.
     *
     * @type {!boolean}
     * @default false
     */
    this.down = template.down || false;

};

/**
 * All mouse buttons that may be represented by a
 * {@link Guacamole.Mouse.State}. 
 *
 * @readonly
 * @enum
 */
Guacamole.Mouse.State.Buttons = {

    /**
     * The name of the {@link Guacamole.Mouse.State} property representing the
     * left mouse button.
     *
     * @constant
     * @type {!string}
     */
    LEFT : 'left',

    /**
     * The name of the {@link Guacamole.Mouse.State} property representing the
     * middle mouse button.
     *
     * @constant
     * @type {!string}
     */
    MIDDLE : 'middle',

    /**
     * The name of the {@link Guacamole.Mouse.State} property representing the
     * right mouse button.
     *
     * @constant
     * @type {!string}
     */
    RIGHT : 'right',

    /**
     * The name of the {@link Guacamole.Mouse.State} property representing the
     * up mouse button (the fourth mouse button, clicked when the mouse scroll
     * wheel is scrolled up).
     *
     * @constant
     * @type {!string}
     */
    UP : 'up',

    /**
     * The name of the {@link Guacamole.Mouse.State} property representing the
     * down mouse button (the fifth mouse button, clicked when the mouse scroll
     * wheel is scrolled up).
     *
     * @constant
     * @type {!string}
     */
    DOWN : 'down'

};

/**
 * Base event type for all mouse events. The mouse producing the event may be
 * the user's local mouse (as with {@link Guacamole.Mouse}) or an emulated
 * mouse (as with {@link Guacamole.Mouse.Touchpad}).
 *
 * @constructor
 * @augments Guacamole.Event.DOMEvent
 * @param {!string} type
 *     The type name of the event ("mousedown", "mouseup", etc.)
 *
 * @param {!Guacamole.Mouse.State} state
 *     The current mouse state.
 *     
 * @param {Event|Event[]} [events=[]]
 *     The DOM events that are related to this event, if any.
 */
Guacamole.Mouse.Event = function MouseEvent(type, state, events) {

    Guacamole.Event.DOMEvent.call(this, type, events);

    /**
     * The name of the event handler used by the Guacamole JavaScript API for
     * this event prior to the migration to Guacamole.Event.Target.
     *
     * @private
     * @constant
     * @type {!string}
     */
    var legacyHandlerName = 'on' + this.type;

    /**
     * The current mouse state at the time this event was fired.
     *
     * @type {!Guacamole.Mouse.State}
     */
    this.state = state;

    /**
     * @inheritdoc
     */
    this.invokeLegacyHandler = function invokeLegacyHandler(target) {
        if (target[legacyHandlerName]) {

            this.preventDefault();
            this.stopPropagation();

            target[legacyHandlerName](this.state);

        }
    };

};

/**
 * An object which can dispatch {@link Guacamole.Mouse.Event} objects
 * representing mouse events. These mouse events may be produced from an actual
 * mouse device (as with {@link Guacamole.Mouse}), from an emulated mouse
 * device (as with {@link Guacamole.Mouse.Touchpad}, or may be programmatically
 * generated (using functions like [dispatch()]{@link Guacamole.Mouse.Event.Target#dispatch},
 * [press()]{@link Guacamole.Mouse.Event.Target#press}, and
 * [release()]{@link Guacamole.Mouse.Event.Target#release}).
 * 
 * @constructor
 * @augments Guacamole.Event.Target
 */
Guacamole.Mouse.Event.Target = function MouseEventTarget() {

    Guacamole.Event.Target.call(this);

    /**
     * The current mouse state. The properties of this state are updated when
     * mouse events fire. This state object is also passed in as a parameter to
     * the handler of any mouse events.
     *
     * @type {!Guacamole.Mouse.State}
     */
    this.currentState = new Guacamole.Mouse.State();

    /**
     * Fired whenever a mouse button is effectively pressed. Depending on the
     * object dispatching the event, this can be due to a true mouse button
     * press ({@link Guacamole.Mouse}), an emulated mouse button press from a
     * touch gesture ({@link Guacamole.Mouse.Touchpad} and
     * {@link Guacamole.Mouse.Touchscreen}), or may be programmatically
     * generated through [dispatch()]{@link Guacamole.Mouse.Event.Target#dispatch},
     * [press()]{@link Guacamole.Mouse.Event.Target#press}, or
     * [click()]{@link Guacamole.Mouse.Event.Target#click}.
     *
     * @event Guacamole.Mouse.Event.Target#mousedown
     * @param {!Guacamole.Mouse.Event} event
     *     The mousedown event that was fired.
     */

    /**
     * Fired whenever a mouse button is effectively released. Depending on the
     * object dispatching the event, this can be due to a true mouse button
     * release ({@link Guacamole.Mouse}), an emulated mouse button release from
     * a touch gesture ({@link Guacamole.Mouse.Touchpad} and
     * {@link Guacamole.Mouse.Touchscreen}), or may be programmatically
     * generated through [dispatch()]{@link Guacamole.Mouse.Event.Target#dispatch},
     * [release()]{@link Guacamole.Mouse.Event.Target#release}, or
     * [click()]{@link Guacamole.Mouse.Event.Target#click}.
     *
     * @event Guacamole.Mouse.Event.Target#mouseup
     * @param {!Guacamole.Mouse.Event} event
     *     The mouseup event that was fired.
     */

    /**
     * Fired whenever the mouse pointer is effectively moved. Depending on the
     * object dispatching the event, this can be due to true mouse movement
     * ({@link Guacamole.Mouse}), emulated mouse movement from
     * a touch gesture ({@link Guacamole.Mouse.Touchpad} and
     * {@link Guacamole.Mouse.Touchscreen}), or may be programmatically
     * generated through [dispatch()]{@link Guacamole.Mouse.Event.Target#dispatch},
     * or [move()]{@link Guacamole.Mouse.Event.Target#move}.
     *
     * @event Guacamole.Mouse.Event.Target#mousemove
     * @param {!Guacamole.Mouse.Event} event
     *     The mousemove event that was fired.
     */

    /**
     * Fired whenever the mouse pointer leaves the boundaries of the element
     * being monitored for interaction. This will only ever be automatically
     * fired due to movement of an actual mouse device via
     * {@link Guacamole.Mouse} unless programmatically generated through
     * [dispatch()]{@link Guacamole.Mouse.Event.Target#dispatch},
     * or [out()]{@link Guacamole.Mouse.Event.Target#out}.
     *
     * @event Guacamole.Mouse.Event.Target#mouseout
     * @param {!Guacamole.Mouse.Event} event
     *     The mouseout event that was fired.
     */

    /**
     * Presses the given mouse button, if it isn't already pressed. Valid
     * button names are defined by {@link Guacamole.Mouse.State.Buttons} and
     * correspond to the button-related properties of
     * {@link Guacamole.Mouse.State}.
     *
     * @fires Guacamole.Mouse.Event.Target#mousedown
     *
     * @param {!string} button
     *     The name of the mouse button to press, as defined by
     *     {@link Guacamole.Mouse.State.Buttons}.
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM events that are related to the mouse button press, if any.
     */
    this.press = function press(button, events) {
        if (!this.currentState[button]) {
            this.currentState[button] = true;
            this.dispatch(new Guacamole.Mouse.Event('mousedown', this.currentState, events));
        }
    };

    /**
     * Releases the given mouse button, if it isn't already released. Valid
     * button names are defined by {@link Guacamole.Mouse.State.Buttons} and
     * correspond to the button-related properties of
     * {@link Guacamole.Mouse.State}.
     *
     * @fires Guacamole.Mouse.Event.Target#mouseup
     *
     * @param {!string} button
     *     The name of the mouse button to release, as defined by
     *     {@link Guacamole.Mouse.State.Buttons}.
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM events related to the mouse button release, if any.
     */
    this.release = function release(button, events) {
        if (this.currentState[button]) {
            this.currentState[button] = false;
            this.dispatch(new Guacamole.Mouse.Event('mouseup', this.currentState, events));
        }
    };

    /**
     * Clicks (presses and releases) the given mouse button. Valid button
     * names are defined by {@link Guacamole.Mouse.State.Buttons} and
     * correspond to the button-related properties of
     * {@link Guacamole.Mouse.State}.
     *
     * @fires Guacamole.Mouse.Event.Target#mousedown
     * @fires Guacamole.Mouse.Event.Target#mouseup
     *
     * @param {!string} button
     *     The name of the mouse button to click, as defined by
     *     {@link Guacamole.Mouse.State.Buttons}.
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM events related to the click, if any.
     */
    this.click = function click(button, events) {
        this.press(button, events);
        this.release(button, events);
    };

    /**
     * Moves the mouse to the given coordinates.
     *
     * @fires Guacamole.Mouse.Event.Target#mousemove
     *
     * @param {!(Guacamole.Position|object)} position
     *     The new coordinates of the mouse pointer. This object may be a
     *     {@link Guacamole.Position} or any object with "x" and "y"
     *     properties.
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM events related to the mouse movement, if any.
     */
    this.move = function move(position, events) {

        if (this.currentState.x !== position.x || this.currentState.y !== position.y) {
            this.currentState.x = position.x;
            this.currentState.y = position.y;
            this.dispatch(new Guacamole.Mouse.Event('mousemove', this.currentState, events));
        }

    };

    /**
     * Notifies event listeners that the mouse pointer has left the boundaries
     * of the area being monitored for mouse events.
     *
     * @fires Guacamole.Mouse.Event.Target#mouseout
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM events related to the mouse leaving the boundaries of the
     *     monitored object, if any.
     */
    this.out = function out(events) {
        this.dispatch(new Guacamole.Mouse.Event('mouseout', this.currentState, events));
    };

    /**
     * Releases all mouse buttons that are currently pressed. If all mouse
     * buttons have already been released, this function has no effect.
     *
     * @fires Guacamole.Mouse.Event.Target#mouseup
     *
     * @param {Event|Event[]} [events=[]]
     *     The DOM event related to all mouse buttons being released, if any.
     */
    this.reset = function reset(events) {
        for (var button in Guacamole.Mouse.State.Buttons) {
            this.release(Guacamole.Mouse.State.Buttons[button], events);
        }
    };

};

/**
 * Provides cross-browser relative touch event translation for a given element.
 * 
 * Touch events are translated into mouse events as if the touches occurred
 * on a touchpad (drag to push the mouse pointer, tap to click).
 * 
 * @example
 * var touchpad = new Guacamole.Mouse.Touchpad(client.getDisplay().getElement());
 *
 * // Emulate a mouse using touchpad-style gestures, forwarding all mouse
 * // interaction over Guacamole connection
 * touchpad.onEach(['mousedown', 'mousemove', 'mouseup'], function sendMouseEvent(e) {
 *
 *     // Re-show software mouse cursor if possibly hidden by a prior call to
 *     // showCursor(), such as a "mouseout" event handler that hides the
 *     // cursor
 *     client.getDisplay().showCursor(true);
 *
 *     client.sendMouseState(e.state, true);
 *
 * });
 *
 * @constructor
 * @augments Guacamole.Mouse.Event.Target
 * @param {!Element} element
 *     The Element to use to provide touch events.
 */
Guacamole.Mouse.Touchpad = function Touchpad(element) {

    Guacamole.Mouse.Event.Target.call(this);

    /**
     * The "mouseout" event will never be fired by Guacamole.Mouse.Touchpad.
     *
     * @ignore
     * @event Guacamole.Mouse.Touchpad#mouseout
     */

    /**
     * Reference to this Guacamole.Mouse.Touchpad.
     *
     * @private
     * @type {!Guacamole.Mouse.Touchpad}
     */
    var guac_touchpad = this;

    /**
     * The distance a two-finger touch must move per scrollwheel event, in
     * pixels.
     *
     * @type {!number}
     */
    this.scrollThreshold = 20 * (window.devicePixelRatio || 1);

    /**
     * The maximum number of milliseconds to wait for a touch to end for the
     * gesture to be considered a click.
     *
     * @type {!number}
     */
    this.clickTimingThreshold = 250;

    /**
     * The maximum number of pixels to allow a touch to move for the gesture to
     * be considered a click.
     *
     * @type {!number}
     */
    this.clickMoveThreshold = 10 * (window.devicePixelRatio || 1);

    /**
     * The current mouse state. The properties of this state are updated when
     * mouse events fire. This state object is also passed in as a parameter to
     * the handler of any mouse events.
     * 
     * @type {!Guacamole.Mouse.State}
     */
    this.currentState = new Guacamole.Mouse.State();

    var touch_count = 0;
    var last_touch_x = 0;
    var last_touch_y = 0;
    var last_touch_time = 0;
    var pixels_moved = 0;

    var touch_buttons = {
        1: "left",
        2: "right",
        3: "middle"
    };

    var gesture_in_progress = false;
    var click_release_timeout = null;

    element.addEventListener("touchend", function(e) {
        
        e.preventDefault();
            
        // If we're handling a gesture AND this is the last touch
        if (gesture_in_progress && e.touches.length === 0) {
            
            var time = new Date().getTime();

            // Get corresponding mouse button
            var button = touch_buttons[touch_count];

            // If mouse already down, release anad clear timeout
            if (guac_touchpad.currentState[button]) {

                // Fire button up event
                guac_touchpad.release(button, e);

                // Clear timeout, if set
                if (click_release_timeout) {
                    window.clearTimeout(click_release_timeout);
                    click_release_timeout = null;
                }

            }

            // If single tap detected (based on time and distance)
            if (time - last_touch_time <= guac_touchpad.clickTimingThreshold
                    && pixels_moved < guac_touchpad.clickMoveThreshold) {

                // Fire button down event
                guac_touchpad.press(button, e);

                // Delay mouse up - mouse up should be canceled if
                // touchstart within timeout.
                click_release_timeout = window.setTimeout(function() {
                    
                    // Fire button up event
                    guac_touchpad.release(button, e);

                    // Gesture now over
                    gesture_in_progress = false;

                }, guac_touchpad.clickTimingThreshold);

            }

            // If we're not waiting to see if this is a click, stop gesture
            if (!click_release_timeout)
                gesture_in_progress = false;

        }

    }, false);

    element.addEventListener("touchstart", function(e) {

        e.preventDefault();

        // Track number of touches, but no more than three
        touch_count = Math.min(e.touches.length, 3);

        // Clear timeout, if set
        if (click_release_timeout) {
            window.clearTimeout(click_release_timeout);
            click_release_timeout = null;
        }

        // Record initial touch location and time for touch movement
        // and tap gestures
        if (!gesture_in_progress) {

            // Stop mouse events while touching
            gesture_in_progress = true;

            // Record touch location and time
            var starting_touch = e.touches[0];
            last_touch_x = starting_touch.clientX;
            last_touch_y = starting_touch.clientY;
            last_touch_time = new Date().getTime();
            pixels_moved = 0;

        }

    }, false);

    element.addEventListener("touchmove", function(e) {

        e.preventDefault();

        // Get change in touch location
        var touch = e.touches[0];
        var delta_x = touch.clientX - last_touch_x;
        var delta_y = touch.clientY - last_touch_y;

        // Track pixels moved
        pixels_moved += Math.abs(delta_x) + Math.abs(delta_y);

        // If only one touch involved, this is mouse move
        if (touch_count === 1) {

            // Calculate average velocity in Manhatten pixels per millisecond
            var velocity = pixels_moved / (new Date().getTime() - last_touch_time);

            // Scale mouse movement relative to velocity
            var scale = 1 + velocity;

            // Update mouse location
            var position = new Guacamole.Position(guac_touchpad.currentState);
            position.x += delta_x*scale;
            position.y += delta_y*scale;

            // Prevent mouse from leaving screen
            position.x = Math.min(Math.max(0, position.x), element.offsetWidth - 1);
            position.y = Math.min(Math.max(0, position.y), element.offsetHeight - 1);

            // Fire movement event, if defined
            guac_touchpad.move(position, e);

            // Update touch location
            last_touch_x = touch.clientX;
            last_touch_y = touch.clientY;

        }

        // Interpret two-finger swipe as scrollwheel
        else if (touch_count === 2) {

            // If change in location passes threshold for scroll
            if (Math.abs(delta_y) >= guac_touchpad.scrollThreshold) {

                // Decide button based on Y movement direction
                var button;
                if (delta_y > 0) button = "down";
                else             button = "up";

                guac_touchpad.click(button, e);

                // Only update touch location after a scroll has been
                // detected
                last_touch_x = touch.clientX;
                last_touch_y = touch.clientY;

            }

        }

    }, false);

};

/**
 * Provides cross-browser absolute touch event translation for a given element.
 *
 * Touch events are translated into mouse events as if the touches occurred
 * on a touchscreen (tapping anywhere on the screen clicks at that point,
 * long-press to right-click).
 *
 * @example
 * var touchscreen = new Guacamole.Mouse.Touchscreen(client.getDisplay().getElement());
 *
 * // Emulate a mouse using touchscreen-style gestures, forwarding all mouse
 * // interaction over Guacamole connection
 * touchscreen.onEach(['mousedown', 'mousemove', 'mouseup'], function sendMouseEvent(e) {
 *
 *     // Re-show software mouse cursor if possibly hidden by a prior call to
 *     // showCursor(), such as a "mouseout" event handler that hides the
 *     // cursor
 *     client.getDisplay().showCursor(true);
 *
 *     client.sendMouseState(e.state, true);
 *
 * });
 *
 * @constructor
 * @augments Guacamole.Mouse.Event.Target
 * @param {!Element} element
 *     The Element to use to provide touch events.
 */
Guacamole.Mouse.Touchscreen = function Touchscreen(element) {

    Guacamole.Mouse.Event.Target.call(this);

    /**
     * The "mouseout" event will never be fired by Guacamole.Mouse.Touchscreen.
     *
     * @ignore
     * @event Guacamole.Mouse.Touchscreen#mouseout
     */

    /**
     * Reference to this Guacamole.Mouse.Touchscreen.
     *
     * @private
     * @type {!Guacamole.Mouse.Touchscreen}
     */
    var guac_touchscreen = this;

    /**
     * Whether a gesture is known to be in progress. If false, touch events
     * will be ignored.
     *
     * @private
     * @type {!boolean}
     */
    var gesture_in_progress = false;

    /**
     * The start X location of a gesture.
     *
     * @private
     * @type {number}
     */
    var gesture_start_x = null;

    /**
     * The start Y location of a gesture.
     *
     * @private
     * @type {number}
     */
    var gesture_start_y = null;

    /**
     * The timeout associated with the delayed, cancellable click release.
     *
     * @private
     * @type {number}
     */
    var click_release_timeout = null;

    /**
     * The timeout associated with long-press for right click.
     *
     * @private
     * @type {number}
     */
    var long_press_timeout = null;

    /**
     * The distance a two-finger touch must move per scrollwheel event, in
     * pixels.
     *
     * @type {!number}
     */
    this.scrollThreshold = 20 * (window.devicePixelRatio || 1);

    /**
     * The maximum number of milliseconds to wait for a touch to end for the
     * gesture to be considered a click.
     *
     * @type {!number}
     */
    this.clickTimingThreshold = 250;

    /**
     * The maximum number of pixels to allow a touch to move for the gesture to
     * be considered a click.
     *
     * @type {!number}
     */
    this.clickMoveThreshold = 16 * (window.devicePixelRatio || 1);

    /**
     * The amount of time a press must be held for long press to be
     * detected.
     */
    this.longPressThreshold = 500;

    /**
     * Returns whether the given touch event exceeds the movement threshold for
     * clicking, based on where the touch gesture began.
     *
     * @private
     * @param {!TouchEvent} e
     *     The touch event to check.
     *
     * @return {!boolean}
     *     true if the movement threshold is exceeded, false otherwise.
     */
    function finger_moved(e) {
        var touch = e.touches[0] || e.changedTouches[0];
        var delta_x = touch.clientX - gesture_start_x;
        var delta_y = touch.clientY - gesture_start_y;
        return Math.sqrt(delta_x*delta_x + delta_y*delta_y) >= guac_touchscreen.clickMoveThreshold;
    }

    /**
     * Begins a new gesture at the location of the first touch in the given
     * touch event.
     * 
     * @private
     * @param {!TouchEvent} e
     *     The touch event beginning this new gesture.
     */
    function begin_gesture(e) {
        var touch = e.touches[0];
        gesture_in_progress = true;
        gesture_start_x = touch.clientX;
        gesture_start_y = touch.clientY;
    }

    /**
     * End the current gesture entirely. Wait for all touches to be done before
     * resuming gesture detection.
     * 
     * @private
     */
    function end_gesture() {
        window.clearTimeout(click_release_timeout);
        window.clearTimeout(long_press_timeout);
        gesture_in_progress = false;
    }

    element.addEventListener("touchend", function(e) {

        // Do not handle if no gesture
        if (!gesture_in_progress)
            return;

        // Ignore if more than one touch
        if (e.touches.length !== 0 || e.changedTouches.length !== 1) {
            end_gesture();
            return;
        }

        // Long-press, if any, is over
        window.clearTimeout(long_press_timeout);

        // Always release mouse button if pressed
        guac_touchscreen.release(Guacamole.Mouse.State.Buttons.LEFT, e);

        // If finger hasn't moved enough to cancel the click
        if (!finger_moved(e)) {

            e.preventDefault();

            // If not yet pressed, press and start delay release
            if (!guac_touchscreen.currentState.left) {

                var touch = e.changedTouches[0];
                guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY));
                guac_touchscreen.press(Guacamole.Mouse.State.Buttons.LEFT, e);

                // Release button after a delay, if not canceled
                click_release_timeout = window.setTimeout(function() {
                    guac_touchscreen.release(Guacamole.Mouse.State.Buttons.LEFT, e);
                    end_gesture();
                }, guac_touchscreen.clickTimingThreshold);

            }

        } // end if finger not moved

    }, false);

    element.addEventListener("touchstart", function(e) {

        // Ignore if more than one touch
        if (e.touches.length !== 1) {
            end_gesture();
            return;
        }

        e.preventDefault();

        // New touch begins a new gesture
        begin_gesture(e);

        // Keep button pressed if tap after left click
        window.clearTimeout(click_release_timeout);

        // Click right button if this turns into a long-press
        long_press_timeout = window.setTimeout(function() {
            var touch = e.touches[0];
            guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY));
            guac_touchscreen.click(Guacamole.Mouse.State.Buttons.RIGHT, e);
            end_gesture();
        }, guac_touchscreen.longPressThreshold);

    }, false);

    element.addEventListener("touchmove", function(e) {

        // Do not handle if no gesture
        if (!gesture_in_progress)
            return;

        // Cancel long press if finger moved
        if (finger_moved(e))
            window.clearTimeout(long_press_timeout);

        // Ignore if more than one touch
        if (e.touches.length !== 1) {
            end_gesture();
            return;
        }

        // Update mouse position if dragging
        if (guac_touchscreen.currentState.left) {

            e.preventDefault();

            // Update state
            var touch = e.touches[0];
            guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY), e);

        }

    }, false);

};
