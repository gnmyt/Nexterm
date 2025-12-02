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

package org.apache.guacamole.token;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Test which verifies the filtering functionality of TokenFilter.
 */
public class TokenFilterTest {

    /**
     * Verifies that token replacement via filter() functions as specified.
     */
    @Test
    public void testFilter() {

        // Create token filter
        TokenFilter tokenFilter = new TokenFilter();
        tokenFilter.setToken("TOKEN_A", "value-of-a");
        tokenFilter.setToken("TOKEN_B", "value-of-b");
        tokenFilter.setToken("TOKEN_C", "Value-of-C");

        // Test basic substitution and escaping
        assertEquals(
            "$${NOPE}hellovalue-of-aworldvalue-of-b${NOT_A_TOKEN}",
            tokenFilter.filter("$$${NOPE}hello${TOKEN_A}world${TOKEN_B}$${NOT_A_TOKEN}")
        );
        
        // Unknown tokens must be interpreted as literals
        assertEquals(
            "${NOPE}hellovalue-of-aworld${TOKEN_D}",
            tokenFilter.filter("${NOPE}hello${TOKEN_A}world${TOKEN_D}")
        );
        
        assertEquals(
            "Value-of-C",
            tokenFilter.filter("${TOKEN_C}")
        );
        
        assertEquals(
            "value-of-c",
            tokenFilter.filter("${TOKEN_C:LOWER}")
        );
        
        assertEquals(
            "VALUE-OF-C",
            tokenFilter.filter("${TOKEN_C:UPPER}")
        );
        
    }
    
    /**
     * Verifies that token replacement via filterValues() functions as
     * specified.
     */
    @Test
    public void testFilterValues() {

        // Create token filter
        TokenFilter tokenFilter = new TokenFilter();
        tokenFilter.setToken("TOKEN_A", "value-of-a");
        tokenFilter.setToken("TOKEN_B", "value-of-b");

        // Create test map
        Map<Integer, String> map = new HashMap<>();
        map.put(1, "$$${NOPE}hello${TOKEN_A}world${TOKEN_B}$${NOT_A_TOKEN}");
        map.put(2, "${NOPE}hello${TOKEN_A}world${TOKEN_C}");
        map.put(3, null);

        // Filter map values
        tokenFilter.filterValues(map);

        // Filter should not affect size of map
        assertEquals(3, map.size());

        // Filtered value 1
        assertEquals(
            "$${NOPE}hellovalue-of-aworldvalue-of-b${NOT_A_TOKEN}",
            map.get(1)
        );
        
        // Filtered value 2
        assertEquals(
            "${NOPE}hellovalue-of-aworld${TOKEN_C}",
            map.get(2)
        );

        // Null values are not filtered
        assertNull(map.get(3));
        
    }
    
}
