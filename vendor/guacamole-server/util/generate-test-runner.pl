#!/usr/bin/env perl
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

#
# generate-test-runner.pl
#
# Generates a test runner for the .c files given on the command line. Each .c
# file may declare any number of tests so long as each test uses CUnit and is
# declared with the following convention:
#
# void test_SUITENAME__TESTNAME() {
#     ...
# }
#
# where TESTNAME is the arbitrary name of the test and SUITENAME is the
# arbitrary name of the test suite that this test belongs to.
#
# Absolutely all tests MUST follow the above convention if they are to be
# picked up by this script. Functions which are not tests MUST NOT follow
# the above convention.
#

use strict;

my $num_tests = 0;
my %test_suites = ();

# Parse all test declarations from given file
while (<>) {
    if ((my $suite_name, my $test_name) = m/^void\s+test_(\w+)__(\w+)/) {
        $num_tests++;
        $test_suites{$suite_name} //= ();
        push @{$test_suites{$suite_name}}, $test_name;
    }
}

# Bail out if there's nothing to write
if ($num_tests == 0) {
    die "No unit tests... :(\n";
}

#
# Common test runner header
#

print <<'END';
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

#include <stdlib.h>
#include <CUnit/TestRun.h>

/**
 * The current test number, as required by the TAP format. This value is
 * automatically incremented by tap_log_test_completed() after each test is
 * run.
 */
int tap_test_number = 1;

/**
 * Logs the status of a CUnit test which just completed. This implementation
 * logs test completion in TAP format.
 *
 * @param test
 *     The CUnit test which just completed.
 *
 * @param suite
 *     The CUnit test suite associated with the test.
 *
 * @param failure
 *     The head element of the test failure list, or NULL if the test passed.
 */
static void tap_log_test_completed(const CU_pTest test,
        const CU_pSuite suite, const CU_pFailureRecord failure) {

    /* Log success/failure in TAP format */
    if (failure == NULL)
        printf("ok %i - [%s] %s: OK\n",
            tap_test_number, suite->pName, test->pName);
    else
        printf("not ok %i - [%s] %s: Assertion failed on %s:%i: %s\n",
            tap_test_number, suite->pName, test->pName,
            failure->strFileName, failure->uiLineNumber,
            failure->strCondition);

    tap_test_number++;

}
END

#
# Prototypes for all test functions
#

while ((my $suite_name, my $test_names) = each (%test_suites)) {
    print "\n/* Automatically-generated prototypes for the $suite_name suite */\n";
    foreach my $test_name (@{ $test_names }) {
        print "void test_${suite_name}__${test_name}();\n";
    }
}

#
# Beginning of main() function body for test runner
#

print <<"END";

/* Automatically-generated test runner */
int main() {

    /* Init CUnit test registry */
    if (CU_initialize_registry() != CUE_SUCCESS)
        return CU_get_error();
END

#
# Within main(), register each test and its corresponding test suite
#

while ((my $suite_name, my $test_names) = each (%test_suites)) {

    print <<"    END";

    /* Create and register all tests for the $suite_name suite */
    CU_pSuite $suite_name = CU_add_suite("$suite_name", NULL, NULL);
    if ($suite_name == NULL
    END

    foreach my $test_name (@{ $test_names }) {
        print <<"        END";
        || CU_add_test($suite_name, "$test_name", test_${suite_name}__${test_name}) == NULL
        END
    }

    print <<"    END";
    ) goto cleanup;
    END

}

#
# End of main() function
#

print <<"END";

    /* Force line-buffered output to ensure log messages are visible even if
     * a test crashes */
    setvbuf(stdout, NULL, _IOLBF, 0);
    setvbuf(stderr, NULL, _IOLBF, 0);

    /* Write TAP header */
    printf("1..$num_tests\\n");

    /* Run all tests in all suites */
    CU_set_test_complete_handler(tap_log_test_completed);
    CU_run_all_tests();

cleanup:
    /* Tests complete */
    CU_cleanup_registry();
    return CU_get_error();

}
END

