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
#include <guacamole/fifo.h>
#include <guacamole/timestamp.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

/**
 * The maximum number of milliseconds to wait for a test event to be added to a
 * fifo.
 */
#define TEST_TIMEOUT 250

/**
 * The maximum number of items permitted in test_fifo.
 */
#define TEST_FIFO_MAX_ITEMS 4

/**
 * The rough amount of time to wait between fifo reads within the test thread,
 * in milliseconds. A random delay between 0ms and this value will be added
 * before each read. This is done to verify that the fifo behaves correctly
 * for cases where the sending thread is producing data much faster than it's
 * being read, slower than it's read, etc.
 */
#define TEST_READ_INTERVAL 10

/**
 * Zero-terminated set of arbitrarily-chosen values that will be provided as
 * the test_value of a sequence of test_events.
 */
unsigned int TEST_VALUES[] = {
     32,  32, 226, 136, 167,  44,  44,  44,
    226, 136, 167,  32,  32,  32,  32,  32,
     65, 112,  97, 119,  99, 104, 101,  10,
     32,  40, 226, 128, 162,  32, 226, 169,
    138,  32, 226, 128, 162,  41,  32,  32,
     71, 117,  97,  99,  97, 109, 101, 111,
    119, 108, 101,  33,  10, /* END */ 0
};

/**
 * Test event for an event fifo. This particular event contains a single
 * integer for verifying that events are received in the order expected, and a
 * chunk of arbitrary padding to ensure the base fifo is capable of supporting
 * events of arbitrary size.
 */
typedef union test_event {

    /**
     * Arbitrary integer test value. This value is primarily intended to allow
     * unit tests to verify the order of received events matches the order they
     * were sent.
     */
    unsigned int test_value;

    /**
     * Arbitrary padding. This member is entirely ignored and is used only to
     * increase the storage size of this event. A wonky prime value is used
     * here to help ensure the tests inherently verify that the base fifo
     * implementation does not somehow depend on power-of-two alignment.
     */
    char padding[73];

} test_event;

/**
 * Test event fifo that extends the guac_fifo base. This event
 * fifo differs from the base only in that it specifically stores test_events
 * alongside an array of expected event values.
 */
typedef struct test_fifo {

    /**
     * The base fifo implementation.
     */
    guac_fifo base;

    /**
     * Storage for all event items in this fifo.
     */
    test_event items[TEST_FIFO_MAX_ITEMS];

    /**
     * A zero-terminated array of all integer values expected to be received as
     * test events, in the order that they are expected to be received.
     */
    unsigned int* expected_values;

} test_fifo;

/**
 * Initializes the given test_fifo, assigning the given set of expected
 * values for later reference by unit tests. The pointer to the expected values
 * MUST remain valid until the text_fifo is destroyed.
 *
 * @param fifo
 *     The test_fifo to initialize.
 *
 * @param expected_values
 *     The zero-terminated set of expected values to be associated with the
 *     given test_fifo.
 */
void test_fifo_init(test_fifo* fifo, unsigned int* expected_values) {

    guac_fifo_init((guac_fifo*) fifo, &fifo->items,
        TEST_FIFO_MAX_ITEMS, sizeof(test_event));

    fifo->expected_values = expected_values;

}

/**
 * Destroys the given test_fifo, releasing any associated resources. It
 * is safe to clean up the set of expected values originally provided to
 * test_fifo_init() after this function has been invoked.
 *
 * @param fifo
 *     The test_fifo to destroy.
 */
void test_fifo_destroy(test_fifo* fifo) {
    guac_fifo_destroy((guac_fifo*) fifo);
}

/**
 * Thread that continuously reads events from the given test_fifo,
 * verifying that each expected value is read in the correct order.
 *
 * @param data
 *     The test_fifo to read from.
 *
 * @return
 *     Always NULL.
 */
static void* queue_read_thread(void* data) {

    test_fifo* fifo = (test_fifo*) data;
    test_event event;

    /* Continuously read values until zero (end of expected values) is reached */
    for (unsigned int* current_expected_value = fifo->expected_values;
            /* Exit condition checked in body of loop*/; current_expected_value++) {

        /* Induce random delays in reading to simulate real-world conditions
         * that may cause the fifo to fill */
        guac_timestamp_msleep(rand() % TEST_READ_INTERVAL);

        int retval = guac_fifo_timed_dequeue(
                (guac_fifo*) fifo, &event, TEST_TIMEOUT);

        /* A value of zero marks the end of the set of expected values, so the
         * fifo SHOULD fail to read at this point */
        if (*current_expected_value == 0) {
            printf("     | END\n");
            CU_ASSERT_FALSE(retval);
            break;
        }

        /* For all other cases, the fifo should succeed in reading the next
         * event, and the value of that event should match the current value
         * from the set of expected values */
        else {
            printf("     | %i\n", event.test_value);
            CU_ASSERT_TRUE(retval);
            CU_ASSERT_EQUAL(event.test_value, *current_expected_value);
        }

        /* Do not continue waiting for more events if the fifo is timing out
         * incorrectly */
        if (!retval)
            break;

    }

    return NULL;

}

/**
 * Generic base test that sends all values in TEST_VALUES at the given
 * interval. Values are read by a separate thread that instead reads at
 * TEST_READ_INTERVAL, allowing the send/receive rates to differ. Timing
 * between each send/receive attempt is varied randomly but is always bounded
 * by the relevant interval.
 *
 * @param send_interval
 *     The rough number of milliseconds to wait between sending each event. The
 *     true number of milliseconds that elapse between each subsequent send
 *     attempt is varied randomly, with this provided value functioning as an
 *     upper bound.
 */
static void verify_send_receive(int send_interval) {

    test_fifo fifo;

    /* Create a test fifo that verifies each value within TEST_VALUES is
     * received in order */
    test_fifo_init(&fifo, TEST_VALUES);

    /* Both this function and the thread it spawns will log sent/received event
     * values to STDOUT for sake of debugging and verification */
    printf("Sent | Received\n"
           "---- | --------\n");

    /* Spawn thread that can independently wait for events to be flagged */
    pthread_t test_thread;
    CU_ASSERT_FALSE_FATAL(pthread_create(&test_thread, NULL, queue_read_thread, &fifo));

    /* Send all test values in order */
    for (unsigned int* current = TEST_VALUES; *current != 0; current++) {

        /* Pull next test value from TEST_VALUES array */
        test_event event = {
            .test_value = *current
        };

        /* Induce random delays in reading to simulate real-world conditions
         * that may cause the fifo to fill */
        if (send_interval)
            guac_timestamp_msleep(rand() % send_interval);

        printf("%4i |\n", event.test_value);
        guac_fifo_enqueue((guac_fifo*) &fifo, &event);

    }

    /* All test values have now been sent */
    printf(" END |\n");

    /* Wait for thread to finish waiting for events */
    CU_ASSERT_FALSE(pthread_join(test_thread, NULL));

    test_fifo_destroy(&fifo);

}

/**
 * Verify that the base fifo implementation functions correctly when events
 * are sent slower than they are read.
 */
void test_fifo__slow_add() {

    /* Add context for subsequent logging of sent/received values to STDOUT */
    printf("-------- %s() --------\n", __func__);

    /* Send at half the speed of the reading thread */
    verify_send_receive(TEST_READ_INTERVAL * 2);

}

/**
 * Verify that the base fifo implementation functions correctly when events
 * are sent faster than they are read.
 */
void test_fifo__fast_add() {

    /* Add context for subsequent logging of sent/received values to STDOUT */
    printf("-------- %s() --------\n", __func__);

    /* Send as quickly as possible (much faster than reading thread) */
    verify_send_receive(0);

}

/**
 * Verify that the base fifo implementation functions correctly when events
 * are sent at roughly the same speed as the reading thread.
 */
void test_fifo__interleaved() {

    /* Add context for subsequent logging of sent/received values to STDOUT */
    printf("-------- %s() --------\n", __func__);

    /* Send at roughly same speed as reading thread */
    verify_send_receive(TEST_READ_INTERVAL);

}

