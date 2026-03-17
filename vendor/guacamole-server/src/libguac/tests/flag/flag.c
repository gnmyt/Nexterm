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

#include <CUnit/CUnit.h>
#include <guacamole/flag.h>
#include <pthread.h>
#include <stdint.h>

/**
 * The maximum number of milliseconds to wait for a test event to be flagged.
 */
#define TEST_TIMEOUT 250

/**
 * Arbitrary test event #1.
 */
#define TEST_EVENT_A 1

/**
 * Arbitrary test event #2.
 */
#define TEST_EVENT_B 2

/**
 * Arbitrary test event #3.
 */
#define TEST_EVENT_C 16

/**
 * Arbitrary test event #4.
 */
#define TEST_EVENT_D 64

/**
 * Thread that waits up to TEST_TIMEOUT milliseconds for TEST_EVENT_B or
 * TEST_EVENT_C to be flagged on a given guac_flag, returning the
 * result of that wait.
 *
 * @param data
 *     The guac_flag to wait on.
 *
 * @return
 *     An intptr_t (NOT a pointer) containing the value returned by
 *     guac_flag_timedwait_and_lock().
 */
static void* flag_wait_thread(void* data) {

    guac_flag* flag = (guac_flag*) data;

    int retval = guac_flag_timedwait_and_lock(flag, TEST_EVENT_B | TEST_EVENT_C, TEST_TIMEOUT);
    guac_flag_unlock(flag);

    return (void*) ((intptr_t) retval);

}

/**
 * Waits up to TEST_TIMEOUT milliseconds for TEST_EVENT_B or TEST_EVENT_C to be
 * flagged on the given guac_flag, returning the result of that
 * wait. If provided, optional sets of flags will be additionally set or
 * cleared after the wait for the flag has started.
 *
 * @param flag
 *     The guac_flag to wait on.
 *
 * @param set_flags
 *     The flags that should be set, if any.
 *
 * @param clear_flags
 *     The flags that should be cleared, if any.
 *
 * @return
 *     The value returned by guac_flag_timedwait_and_lock() after
 *     waiting for TEST_EVENT_B or TEST_EVENT_C to be flagged.
 */
static int wait_for_flag(guac_flag* flag, int set_flags, int clear_flags) {

    /* Spawn thread that can independently wait for events to be flagged */
    pthread_t test_thread;
    CU_ASSERT_FALSE_FATAL(pthread_create(&test_thread, NULL, flag_wait_thread, flag));

    /* Set/clear any requested event flags */
    if (set_flags) guac_flag_set(flag, set_flags);
    if (clear_flags) guac_flag_clear(flag, clear_flags);

    /* Wait for thread to finish waiting for events */
    void* retval;
    CU_ASSERT_FALSE(pthread_join(test_thread, &retval));

    return (int) ((intptr_t) retval);

}

/**
 * Verifies that a thread waiting on a particular event will NOT be notified if
 * absolutely zero events ever occur.
 */
void test_flag__ignore_total_silence() {

    guac_flag test_flag;
    guac_flag_init(&test_flag);

    /* Verify no interesting events occur if we set zero flags */
    CU_ASSERT_FALSE(wait_for_flag(&test_flag, 0, 0));

    guac_flag_destroy(&test_flag);

}

/**
 * Verifies that a thread waiting on a particular event will NOT be notified if
 * that event never occurs, even if other events are occurring.
 */
void test_flag__ignore_uninteresting_events() {

    guac_flag test_flag;
    guac_flag_init(&test_flag);

    /* Verify no interesting events occurred if we only fire uninteresting
     * events */
    CU_ASSERT_FALSE(wait_for_flag(&test_flag, TEST_EVENT_A, 0));
    CU_ASSERT_FALSE(wait_for_flag(&test_flag, TEST_EVENT_D, TEST_EVENT_C));
    CU_ASSERT_FALSE(wait_for_flag(&test_flag, TEST_EVENT_A | TEST_EVENT_D, 0));

    guac_flag_destroy(&test_flag);

}

/**
 * Verifies that a thread waiting on a particular event will be notified when
 * that event occurs.
 */
void test_flag__wake_for_interesting_events() {

    guac_flag test_flag;
    guac_flag_init(&test_flag);

    /* Verify interesting events are reported if fired ... */
    CU_ASSERT_TRUE(wait_for_flag(&test_flag, TEST_EVENT_B | TEST_EVENT_C, 0));

    /* ... and continue to be reported if they remain set ... */
    guac_flag_clear(&test_flag, TEST_EVENT_B);
    CU_ASSERT_TRUE(wait_for_flag(&test_flag, 0, 0));

    /* ... but not if all interesting events have since been cleared */
    guac_flag_clear(&test_flag, TEST_EVENT_C);
    CU_ASSERT_FALSE(wait_for_flag(&test_flag, 0, 0));

    guac_flag_destroy(&test_flag);

}

