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
#include <guacamole/client.h>
#include <guacamole/layer.h>

#include <stdbool.h>

/**
 * Test which verifies that buffers can be allocated and freed using the pool
 * of buffers available to each guac_client, and that doing so does not disturb
 * the similar pool of layers.
 */
void test_client__buffer_pool() {

    guac_client* client;

    int i;
    bool seen[GUAC_BUFFER_POOL_INITIAL_SIZE] = { 0 };

    guac_layer* layer;

    /* Get client */
    client = guac_client_alloc();
    CU_ASSERT_PTR_NOT_NULL_FATAL(client);

    /* Fill pool */
    for (i=0; i<GUAC_BUFFER_POOL_INITIAL_SIZE; i++) {

        /* Allocate and throw away a layer (should not disturb buffer alloc) */
        CU_ASSERT_PTR_NOT_NULL_FATAL(guac_client_alloc_layer(client));

        layer = guac_client_alloc_buffer(client);

        /* Index should be within pool size */
        CU_ASSERT_PTR_NOT_NULL_FATAL(layer);
        CU_ASSERT_FATAL(layer->index < 0);
        CU_ASSERT_FATAL(layer->index >= -GUAC_BUFFER_POOL_INITIAL_SIZE);

        /* This should be a layer we have not seen yet */
        CU_ASSERT_FALSE(seen[-layer->index - 1]);
        seen[-layer->index - 1] = true;

        guac_client_free_buffer(client, layer);

    }

    /* Now that pool is filled, we should get a previously seen layer */
    layer = guac_client_alloc_buffer(client);

    CU_ASSERT_FATAL(layer->index < 0);
    CU_ASSERT_FATAL(layer->index >= -GUAC_BUFFER_POOL_INITIAL_SIZE);
    CU_ASSERT_TRUE(seen[-layer->index - 1]);

    /* Free client */
    guac_client_free(client);

}

