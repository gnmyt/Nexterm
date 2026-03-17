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

/* global Guacamole, jasmine, expect */

describe("Guacamole.Event", function EventSpec() {

    /**
     * Test subclass of {@link Guacamole.Event} which provides a single
     * "value" property supports an "ontest" legacy event handler.
     *
     * @constructor
     * @augments Guacamole.Event
     * @param {object} value
     *     An arbitrary value to expose to the handler of the event.
     */
    var TestEvent = function TestEvent(value) {

        Guacamole.Event.apply(this, [ 'test' ]);

        /**
         * An arbitrary value to expose to the handler of this event.
         *
         * @type {object}
         */
        this.value = value;

        /**
         * @inheritdoc
         */
        this.invokeLegacyHandler = function invokeLegacyHandler(target) {
            if (target.ontest)
                target.ontest(value);
        };

    };

    /**
     * Event target instance which will receive each fired {@link TestEvent}.
     *
     * @type {Guacamole.Event.Target}
     */
    var eventTarget;

    beforeEach(function() {
        eventTarget = new Guacamole.Event.Target();
    });

    describe("when an event is dispatched", function(){

        it("should invoke the legacy handler for matching events", function() {

            eventTarget.ontest = jasmine.createSpy('ontest');
            eventTarget.dispatch(new TestEvent('event1'));
            expect(eventTarget.ontest).toHaveBeenCalledWith('event1');

        });

        it("should invoke all listeners for matching events", function() {

            var listener1 = jasmine.createSpy('listener1');
            var listener2 = jasmine.createSpy('listener2');

            eventTarget.on('test', listener1);
            eventTarget.on('test', listener2);

            eventTarget.dispatch(new TestEvent('event2'));

            expect(listener1).toHaveBeenCalledWith(jasmine.objectContaining({ type : 'test', value : 'event2' }), eventTarget);
            expect(listener2).toHaveBeenCalledWith(jasmine.objectContaining({ type : 'test', value : 'event2' }), eventTarget);

        });

        it("should not invoke any listeners for non-matching events", function() {

            var listener1 = jasmine.createSpy('listener1');
            var listener2 = jasmine.createSpy('listener2');

            eventTarget.on('test2', listener1);
            eventTarget.on('test2', listener2);

            eventTarget.dispatch(new TestEvent('event3'));

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();

        });

        it("should not invoke any listeners that have been removed", function() {

            var listener1 = jasmine.createSpy('listener1');
            var listener2 = jasmine.createSpy('listener2');

            eventTarget.on('test', listener1);
            eventTarget.on('test', listener2);
            eventTarget.off('test', listener1);

            eventTarget.dispatch(new TestEvent('event4'));

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledWith(jasmine.objectContaining({ type : 'test', value : 'event4' }), eventTarget);

        });

    });

    describe("when listeners are removed", function(){

        it("should return whether a listener is successfully removed", function() {

            var listener1 = jasmine.createSpy('listener1');
            var listener2 = jasmine.createSpy('listener2');

            eventTarget.on('test', listener1);
            eventTarget.on('test', listener2);

            expect(eventTarget.off('test', listener1)).toBe(true);
            expect(eventTarget.off('test', listener1)).toBe(false);
            expect(eventTarget.off('test', listener2)).toBe(true);
            expect(eventTarget.off('test', listener2)).toBe(false);

        });

    });
});
