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

describe('Guacamole.Parser', function ParserSpec() {

    /**
     * A single Unicode high surrogate character (any character between U+D800
     * and U+DB7F).
     *
     * @constant
     * @type {!string}
     */
    const HIGH_SURROGATE = '\uD802';

    /**
     * A single Unicode low surrogate character (any character between U+DC00
     * and U+DFFF).
     *
     * @constant
     * @type {!string}
     */
    const LOW_SURROGATE = '\uDF00';

    /**
     * A Unicode surrogate pair, consisting of a high and low surrogate.
     *
     * @constant
     * @type {!string}
     */
    const SURROGATE_PAIR = HIGH_SURROGATE + LOW_SURROGATE;

    /**
     * A 4-character test string containing Unicode characters that require
     * multiple bytes when encoded as UTF-8, including at least one character
     * that is encoded as a surrogate pair in UTF-16.
     *
     * @constant
     * @type {!string}
     */
    const UTF8_MULTIBYTE = '\u72AC' + SURROGATE_PAIR + 'z\u00C1';

    /**
     * The Guacamole.Parser instance to test. This instance is (re)created prior
     * to each test via beforeEach().
     *
     * @type {Guacamole.Parser}
     */
    var parser;

    // Provide each test with a fresh parser
    beforeEach(function() {
        parser = new Guacamole.Parser();
    });

    // Empty instruction
    describe('when an empty instruction is received', function() {

        it('should parse the single empty opcode and invoke oninstruction', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('0.;');
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('', [ ]);
        });

    });

    // Instruction using basic Latin characters
    describe('when an instruction is containing only basic Latin characters', function() {

        it('should correctly parse each element and invoke oninstruction', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('5.test2,'
                + '10.hellohello,'
                + '15.worldworldworld;'
            );
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('test2', [
                'hellohello',
                'worldworldworld'
            ]);
        });

    });

    // Instruction using characters requiring multiple bytes in UTF-8 and
    // surrogate pairs in UTF-16, including an element ending with a surrogate
    // pair
    describe('when an instruction is received containing elements that '
           + 'contain characters involving surrogate pairs', function() {

        it('should correctly parse each element and invoke oninstruction', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('4.test,'
                + '6.a' + UTF8_MULTIBYTE + 'b,'
                + '5.1234' + SURROGATE_PAIR + ','
                + '10.a' + UTF8_MULTIBYTE + UTF8_MULTIBYTE + 'c;'
            );
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('test', [
                'a' + UTF8_MULTIBYTE + 'b',
                '1234' + SURROGATE_PAIR,
                'a' + UTF8_MULTIBYTE + UTF8_MULTIBYTE + 'c'
            ]);
        });

    });

    // Instruction with an element values ending with an incomplete surrogate
    // pair (high or low surrogate only)
    describe('when an instruction is received containing elements that end '
           + 'with incomplete surrogate pairs', function() {

        it('should correctly parse each element and invoke oninstruction', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('4.test,'
                + '5.1234' + HIGH_SURROGATE + ','
                + '5.4567' + LOW_SURROGATE + ';'
            );
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('test', [
                '1234' + HIGH_SURROGATE,
                '4567' + LOW_SURROGATE
            ]);
        });

    });

    // Instruction with element values containing incomplete surrogate pairs,
    describe('when an instruction is received containing incomplete surrogate pairs', function() {

        it('should correctly parse each element and invoke oninstruction', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('5.te' + LOW_SURROGATE + 'st,'
                + '5.12' + HIGH_SURROGATE + '3' + LOW_SURROGATE + ','
                + '6.5' + LOW_SURROGATE + LOW_SURROGATE + '4' + HIGH_SURROGATE + HIGH_SURROGATE + ','
                + '10.' + UTF8_MULTIBYTE + HIGH_SURROGATE + UTF8_MULTIBYTE + HIGH_SURROGATE + ';',
            );
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('te' + LOW_SURROGATE + 'st', [
                '12' + HIGH_SURROGATE + '3' + LOW_SURROGATE,
                '5' + LOW_SURROGATE + LOW_SURROGATE + '4' + HIGH_SURROGATE + HIGH_SURROGATE,
                UTF8_MULTIBYTE + HIGH_SURROGATE + UTF8_MULTIBYTE + HIGH_SURROGATE
            ]);
        });

    });

    // Instruction fed via blocks of characters that accumulate via an external
    // buffer
    describe('when an instruction is received via an external buffer', function() {

        it('should correctly parse each element and invoke oninstruction once ready', function() {
            parser.oninstruction = jasmine.createSpy('oninstruction');
            parser.receive('5.test2,10.hello', true);
            expect(parser.oninstruction).not.toHaveBeenCalled();
            parser.receive('5.test2,10.hellohello,15', true);
            expect(parser.oninstruction).not.toHaveBeenCalled();
            parser.receive('5.test2,10.hellohello,15.worldworldworld;', true);
            expect(parser.oninstruction).toHaveBeenCalledOnceWith('test2', [ 'hellohello', 'worldworldworld' ]);
        });

    });

    // Verify codePointCount() utility function correctly counts codepoints in
    // full strings
    describe('when a string is provided to codePointCount()', function() {

        it('should return the number of codepoints in that string', function() {
            expect(Guacamole.Parser.codePointCount('')).toBe(0);
            expect(Guacamole.Parser.codePointCount('test string')).toBe(11);
            expect(Guacamole.Parser.codePointCount('surrogate' + SURROGATE_PAIR + 'pair')).toBe(14);
            expect(Guacamole.Parser.codePointCount('missing' + HIGH_SURROGATE + 'surrogates' + LOW_SURROGATE)).toBe(19);
            expect(Guacamole.Parser.codePointCount(HIGH_SURROGATE + LOW_SURROGATE + HIGH_SURROGATE)).toBe(2);
            expect(Guacamole.Parser.codePointCount(HIGH_SURROGATE + HIGH_SURROGATE + LOW_SURROGATE)).toBe(2);
        });

    });

    // Verify codePointCount() utility function correctly counts codepoints in
    // substrings
    describe('when a substring is provided to codePointCount()', function() {

        it('should return the number of codepoints in that substring', function() {
            expect(Guacamole.Parser.codePointCount('test string', 0)).toBe(11);
            expect(Guacamole.Parser.codePointCount('surrogate' + SURROGATE_PAIR + 'pair', 5)).toBe(9);
            expect(Guacamole.Parser.codePointCount('missing' + HIGH_SURROGATE + 'surrogates' + LOW_SURROGATE, 2, 17)).toBe(15);
            expect(Guacamole.Parser.codePointCount(HIGH_SURROGATE + LOW_SURROGATE + HIGH_SURROGATE, 0, 2)).toBe(1);
            expect(Guacamole.Parser.codePointCount(HIGH_SURROGATE + HIGH_SURROGATE + LOW_SURROGATE, 1, 2)).toBe(1);
        });

    });

    // Verify toInstruction() utility function correctly encodes instructions
    describe('when an array of elements is provided to toInstruction()', function() {

        it('should return a correctly-encoded Guacamole instruction', function() {
            expect(Guacamole.Parser.toInstruction([ 'test', 'instruction' ])).toBe('4.test,11.instruction;');
            expect(Guacamole.Parser.toInstruction([ 'test' + SURROGATE_PAIR, 'instruction' ]))
                    .toBe('5.test' + SURROGATE_PAIR + ',11.instruction;');
            expect(Guacamole.Parser.toInstruction([ UTF8_MULTIBYTE, HIGH_SURROGATE + 'xyz' + LOW_SURROGATE ]))
                    .toBe('4.' + UTF8_MULTIBYTE + ',5.' + HIGH_SURROGATE + 'xyz' + LOW_SURROGATE + ';');
            expect(Guacamole.Parser.toInstruction([ UTF8_MULTIBYTE, LOW_SURROGATE + 'xyz' + HIGH_SURROGATE ]))
                    .toBe('4.' + UTF8_MULTIBYTE + ',5.' + LOW_SURROGATE + 'xyz' + HIGH_SURROGATE + ';');
        });

    });

});
