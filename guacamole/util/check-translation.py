#!/usr/bin/python
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

import argparse
import json
import os
import re
import sys

parser = argparse.ArgumentParser(description='Compares two JSON translation '
        'files, as used by the Apache Guacamole web application, listing '
        'the strings which appear to be missing or incorrect.')

parser.add_argument('--no-missing', dest='check_missing', action='store_false',
        help='Disables checking for strings which are present in ORIGINAL but '
        'are missing from TRANSLATED. Assuming ORIGINAL represents the set of '
        'strings actually used by the web application, these strings are '
        'those which are missing and need to be defined for the translation '
        'to be complete. By default, the comparison will check for missing '
        'translations.')

parser.add_argument('--no-unused', dest='check_unused', action='store_false',
        help='Disables checking for strings which are present in TRANSLATED '
        'but not in ORIGINAL. Assuming ORIGINAL represents the set of strings '
        'actually used by the web application, these strings are those which '
        'are defined by the translation but unused. By default, the '
        'comparison will check for unused translations.')

parser.add_argument('--check-copied', action='store_true', help='Enables '
        'checking for strings defined in TRANSLATED which are identical to '
        'the corresponding strings in ORIGINAL. Such strings may have been '
        'incorrectly copied verbatim from the original without being '
        'translated at all. It is also possible that both languages simply '
        'use the same text for that string, and the string is correct. As '
        'this test can produce false positives, it is disabled by default.')

parser.add_argument('ORIGINAL', nargs='?', help='The JSON file which should '
        'be used as the basis for comparison. This should be JSON which can '
        'be expected to contain every string used by the web application and '
        'no others. Typically, this will be the primary, original language of '
        'the web application. In the case of Apache Guacamole, this should be '
        'English. If omitted, the file "en.json" within the same directory '
        'as TRANSLATED will be used by default.')

parser.add_argument('TRANSLATED', help='The JSON file which should be '
        'compared against ORIGINAL. This should be the JSON which has been '
        'translated from ORIGINAL, and thus should contain the same set of '
        'strings if the translation is complete.')

args = parser.parse_args()

def flatten_strings(translation, prefix=u''):
    """Reads all translation strings from the given JSON, taking into account
    namespacing, flattening nested namespaces into a single set of key/value
    pairs.

    For example, the following call:

        flatten_strings({
            u'TOP' : {
                u'LETTERS' : {
                    u'A' : u'A',
                    u'B' : u'B'
                },
                u'NUMBERS' : {
                    u'ONE' : u'1',
                    u'TWO' : u'2',
                    u'THREE' : u'3'
                }
            }
        })

    would return:

        {
            u'TOP.LETTERS.A' : u'A',
            u'TOP.LETTERS.B' : u'B',
            u'TOP.NUMBERS.ONE' : u'1',
            u'TOP.NUMBERS.TWO' : u'2',
            u'TOP.NUMBERS.THREE' : u'3'
        }

    Parameters
    ----------
    translation : dict or unicode
        The dict object to read translation strings from, where each key is a
        translation key or namespace and each value is a translation string or
        a dict containing the translations nested within that namespace.
        this object is simply a Unicode string, it will be assumed to be the
        value of a translation string, and the prefix provided will be assumed
        to be the name.

    prefix : unicode, optional
        The namespace prefix to apply to all translation strings within the
        given object, if any. This parameter is optional. If omitted, an empty
        string will be used.

    Returns
    -------
    dict
        An dict whose properties are the names of all translation strings
        contained within the given object.

    """

    strings = {}

    # If the provided object is a string, the prefix is the string name
    if isinstance(translation, unicode):
        strings[prefix] = translation
        return strings

    # Otherwise, if the prefix is non-empty, append a period for children
    if prefix:
        prefix += u'.'

    # For each property of the given object, read all string names
    for key, child in translation.items():

        # Add all string names within the child under its prefix
        for flattened, value in flatten_strings(child, prefix + key).items():
            strings[flattened] = value

    return strings

class Translation:
    """A set of namespaced translation strings read from a JSON file, as
    supported by angular-translate and used by Apache Guacamole.

    Attributes
    ----------
    lang_key : unicode
        The unique key identifying the JSON translation file and the language
        within that file. This will simply be the filename without the ".json"
        extension.
    lang_name : unicode
        The name of the language as defined within the JSON translation file by
        the special "NAME" key. Not all translations will define a "NAME", as
        some translations (those provided by Guacamole extensions) are used as
        overlays for the base translation for that language defined at the web
        application level. If no "NAME" key is present, `lang_name` will be
        `None`.
    strings : dict
        The flattened set of translation key/value pairs. Each key will contain
        all applicable namespaces, separated by periods, as produced by
        `flatten_strings()`. There will be no nested keys.

    """


    def __init__(self, path):
        """
        Parses the details and contents of the JSON translation file at the
        given path.

        Parameters
        ----------
        path : str
            The path to the JSON file containing the translation to be read.

        """

        json_data = open(path).read()
        filename = os.path.basename(path)
        
        self.lang_key  = os.path.splitext(filename)[0]
        self.strings   = flatten_strings(json.loads(json_data))
        self.lang_name = self.strings.get(u'NAME', None)

    def get_missing(self, expected):
        """Returns a list of translation keys which are present in the given
        translation but missing from this translation.

        Parameters
        ----------
        expected : Translation
            The translation to compare this translation against.

        Returns
        -------
        list
            A list of translation keys which are present in the given
            translation but are NOT present in this translation.

        """
        return [ key for key in expected.strings if not key in self.strings ]

    def get_identical(self, other):
        """Returns a list of translation keys which map to the same exact value
        in both this translation and the given translation.

        Parameters
        ----------
        other : Translation
            The translation to compare this translation against.

        Returns
        -------
        list
            A list of translation keys which map to the same exact value in
            both translations.

        """
        return [ key for key, value in self.strings.items()
                if key in other.strings and other.strings[key] == value ]

#
# Translation keys which are expected to always be inherited from the base
# translation and thus should be missing from all translations
#

expected_missing = {
    u'APP.NAME',
    u'APP.VERSION'
}

#
# Regular expression which matches strings that are expected to be copied
# verbatim
#

expected_copied = re.compile('|'.join([
    '^$', # Empty string
    '^@:', # References to other strings
    '^\\d+$', # Numbers
    '^(VNC|RDP|SSH|SFTP|Telnet)$', # Protocol names
    '^(Apache )?Guacamole$' # Guacamole itself
]))

#
# Read provided input files
#

orig = Translation(args.ORIGINAL
        or '{}/en.json'.format(os.path.dirname(args.TRANSLATED)))

trans = Translation(args.TRANSLATED)

print u'Original language: {} ({})'.format(orig.lang_key, orig.lang_name)
print u'Translation language: {} ({})'.format(trans.lang_key, trans.lang_name)

# Ignore keys that are expected to be missing
orig.strings = { key:value for key, value in orig.strings.items()
        if key not in expected_missing }

#
# Perform requested tests
#

missing = trans.get_missing(orig) if args.check_missing else []
unused = orig.get_missing(trans) if args.check_unused else []
copied = orig.get_identical(trans) if args.check_copied else []

# Exclude keys which are expected to be copied
copied = [ key for key in copied
        if not expected_copied.match(orig.strings[key]) ]

#
# Group any errors encountered by type
#

if missing:
    print('\nThe following strings are missing from the translation and '
          'should be added:\n')
    for name in sorted(missing):
        print '    {}'.format(name)

if unused:
    print('\nThe following strings are either NOT defined for the original '
          'language or are expected to be inherited from the original '
          'language and should be removed:\n')
    for name in sorted(unused):
        print '    {}'.format(name)

if copied:
    print('\nThe following strings are identical to the original language '
          'and MIGHT be untranslated:\n')
    for name in sorted(copied):
        print '    {}'.format(name)

#
# Count total number of errors and summarize result
#

errors = len(missing) + len(unused) + len(copied)

if errors:
    print '\n{} error(s) total.'.format(errors)
    sys.exit(1)

print '\nCheck completed successfully. No errors.'

