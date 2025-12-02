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

#include "guacamole/assert.h"
#include "guacamole/error.h"
#include "guacamole/mem.h"
#include "guacamole/private/mem.h"

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

/*
 * ============================================================================
 *
 * IMPORTANT: For compatibility with past usages of libguac, all allocation
 * functions implemented here need to remain compatible with the standard
 * free() function, as there are past usages of libguac functions that expect
 * allocated memory to have been allocated with malloc() or similar. Some good
 * examples of this would be guac_strdup() or guac_user_parse_args_string().
 *
 * It is OK if these allocation functions add new functionality beyond what
 * malloc() provides, but care must be taken to ensure free() can still be used
 * safely and without leaks, even if guac_mem_free() will always be preferred.
 *
 * It is further OK for guac_mem_free() to be incompatible with free() and only
 * usable on memory blocks allocated through guac_mem_alloc() and similar.
 *
 * ============================================================================
 */

int PRIV_guac_mem_ckd_mul(size_t* result, size_t factor_count, const size_t* factors) {

    /* Consider calculation invalid if no factors are provided at all */
    if (factor_count == 0)
        return 1;

    /* Multiply all provided factors together */
    size_t size = *(factors++);
    while (--factor_count && size) {

        size_t factor = *(factors++);

        /* Fail if including this additional factor would exceed SIZE_MAX */
        size_t max_factor = SIZE_MAX / size;
        if (factor > max_factor)
            return 1;

        size *= factor;

    }

    *result = size;
    return 0;

}

int PRIV_guac_mem_ckd_add(size_t* result, size_t term_count, const size_t* terms) {

    /* Consider calculation invalid if no terms are provided at all */
    if (term_count == 0)
        return 1;

    /* Multiply all provided terms together */
    size_t size = *(terms++);
    while (--term_count) {

        size_t term = *(terms++);

        /* Fail if including this additional term would exceed SIZE_MAX */
        size_t max_term = SIZE_MAX - size;
        if (term > max_term)
            return 1;

        size += term;

    }

    *result = size;
    return 0;

}

int PRIV_guac_mem_ckd_sub(size_t* result, size_t term_count, const size_t* terms) {

    /* Consider calculation invalid if no terms are provided at all */
    if (term_count == 0)
        return 1;

    /* Multiply all provided terms together */
    size_t size = *(terms++);
    while (--term_count) {

        size_t term = *(terms++);

        /* Fail if including this additional term would wrap past zero */
        if (term > size)
            return 1;

        size -= term;

    }

    *result = size;
    return 0;

}

size_t PRIV_guac_mem_ckd_mul_or_die(size_t factor_count, const size_t* factors) {

    /* Perform request multiplication, aborting the entire process if the
     * calculation overflows */
    size_t result = 0;
    GUAC_ASSERT(!PRIV_guac_mem_ckd_mul(&result, factor_count, factors));

    return result;

}

size_t PRIV_guac_mem_ckd_add_or_die(size_t term_count, const size_t* terms) {

    /* Perform request addition, aborting the entire process if the calculation
     * overflows */
    size_t result = 0;
    GUAC_ASSERT(!PRIV_guac_mem_ckd_add(&result, term_count, terms));

    return result;

}

size_t PRIV_guac_mem_ckd_sub_or_die(size_t term_count, const size_t* terms) {

    /* Perform request subtraction, aborting the entire process if the
     * calculation overflows */
    size_t result = 0;
    GUAC_ASSERT(!PRIV_guac_mem_ckd_sub(&result, term_count, terms));

    return result;

}

void* PRIV_guac_mem_alloc(size_t factor_count, const size_t* factors) {

    size_t size = 0;

    if (PRIV_guac_mem_ckd_mul(&size, factor_count, factors)) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        return NULL;
    }
    else if (size == 0)
        return NULL;

    void* mem = malloc(size);
    if (mem == NULL) {
        /* C does not require that malloc() set errno (though POSIX does). For
         * portability, we set guac_error here regardless of the underlying
         * behavior of malloc(). */
        guac_error = GUAC_STATUS_NO_MEMORY;
    }

    return mem;

}

void* PRIV_guac_mem_zalloc(size_t factor_count, const size_t* factors) {

    size_t size = 0;

    if (PRIV_guac_mem_ckd_mul(&size, factor_count, factors)) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        return NULL;
    }
    else if (size == 0)
        return NULL;

    void* mem = calloc(1, size);
    if (mem == NULL) {
        /* C does not require that calloc() set errno (though POSIX does). For
         * portability, we set guac_error here regardless of the underlying
         * behavior of calloc(). */
        guac_error = GUAC_STATUS_NO_MEMORY;
    }

    return mem;

}

void* PRIV_guac_mem_realloc(void* mem, size_t factor_count, const size_t* factors) {

    size_t size = 0;

    if (PRIV_guac_mem_ckd_mul(&size, factor_count, factors)) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        return NULL;
    }

    /* Resize to 0 is equivalent to free() */
    if (size == 0) {
        guac_mem_free(mem);
        return NULL;
    }

    void* resized_mem = realloc(mem, size);
    if (resized_mem == NULL) {
        /* C does not require that realloc() set errno (though POSIX does). For
         * portability, we set guac_error here regardless of the underlying
         * behavior of realloc(). */
        guac_error = GUAC_STATUS_NO_MEMORY;
    }

    return resized_mem;

}

void* PRIV_guac_mem_realloc_or_die(void* mem, size_t factor_count, const size_t* factors) {

    /* Reset any past errors for upcoming error check */
    guac_error = GUAC_STATUS_SUCCESS;

    /* Perform requested resize, aborting the entire process if this cannot be
     * done */
    void* resized_mem = PRIV_guac_mem_realloc(mem, factor_count, factors);
    GUAC_ASSERT(resized_mem != NULL || guac_error == GUAC_STATUS_SUCCESS);

    return resized_mem;

}

void PRIV_guac_mem_free(void* mem) {
    free(mem);
}

