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

package org.apache.guacamole.protocol;

import org.apache.guacamole.GuacamoleException;
import org.junit.Assert;
import org.junit.Test;

/**
 * Unit test for GuacamoleStatus that verifies exception translation functions
 * as required.
 */
public class GuacamoleStatusTest {

    /**
     * Verifies that the {@link SUCCESS} status code does NOT translate to a
     * GuacamoleException, but instead throws an IllegalStateException.
     */
    @Test
    public void testSuccessHasNoException() {

        try {
            GuacamoleStatus.SUCCESS.toException("Test message");
            Assert.fail("GuacamoleStatus.SUCCESS must throw "
                    + "IllegalStateException for toException().");
        }
        catch (IllegalStateException e) {
            // Expected
        }

    }

    /**
     * Verifies that each non-success GuacamoleStatus maps to a
     * GuacamoleException associated with that GuacamoleStatus.
     */
    @Test
    public void testStatusExceptionMapping() {

        for (GuacamoleStatus status : GuacamoleStatus.values()) {

            // Ignore SUCCESS status (tested via testSuccessHasNoException())
            if (status == GuacamoleStatus.SUCCESS)
                continue;

            String message = "Test message: " + status;
            GuacamoleException e = status.toException(message);

            Assert.assertEquals("toException() should return a "
                    + "GuacamoleException that maps to the same status.",
                    status, e.getStatus());

            Assert.assertEquals("toException() should return a "
                    + "GuacamoleException that uses the provided message.",
                    message, e.getMessage());

        }

    }

}
