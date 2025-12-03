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

#ifndef GUAC_MEM_H
#define GUAC_MEM_H

/**
 * Provides convenience macros/functions for performing arithmetic on size_t
 * values and for allocating memory, particularly memory related to images,
 * audio, etc. where there are multiple factors affecting the final size.
 *
 * @file mem.h
 */

#include "private/mem.h"

#include <stddef.h>

/**
 * Allocates a contiguous block of memory with the specified size, returning a
 * pointer to the first byte of that block of memory. If multiple sizes are
 * provided, these sizes are multiplied together to produce the final size of
 * the new block. If memory of the specified size cannot be allocated, or if
 * multiplying the sizes would result in integer overflow, guac_error is set
 * appropriately and NULL is returned.
 *
 * This macro is analogous to the standard malloc(), but accepts a list of size
 * factors instead of a single integer size.
 *
 * The pointer returned by guac_mem_alloc() SHOULD be freed with a subsequent call
 * to guac_mem_free(), but MAY instead be freed with a subsequent call to free().
 *
 * @param ...
 *     A series of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the allocated block of memory, or NULL if
 *     such a block could not be allocated. If a block of memory could not be
 *     allocated, guac_error is set appropriately.
 */
#define guac_mem_alloc(...) \
    PRIV_guac_mem_alloc(                                                      \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Allocates a contiguous block of memory with the specified size and with all
 * bytes initialized to zero, returning a pointer to the first byte of that
 * block of memory. If multiple sizes are provided, these sizes are multiplied
 * together to produce the final size of the new block. If memory of the
 * specified size cannot be allocated, or if multiplying the sizes would result
 * in integer overflow, guac_error is set appropriately and NULL is returned.
 *
 * This macro is analogous to the standard calloc(), but accepts a list of size
 * factors instead of a requiring exactly two integer sizes.
 *
 * The pointer returned by guac_mem_zalloc() SHOULD be freed with a subsequent call
 * to guac_mem_free(), but MAY instead be freed with a subsequent call to free().
 *
 * @param ...
 *     A series of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the allocated block of memory, or NULL if
 *     such a block could not be allocated. If a block of memory could not be
 *     allocated, guac_error is set appropriately.
 */
#define guac_mem_zalloc(...) \
    PRIV_guac_mem_zalloc(                                                     \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Multiplies together each of the given values, storing the result in a size_t
 * variable via the provided pointer. If the result of the multiplication
 * overflows the limits of a size_t, non-zero is returned to signal failure.
 *
 * If the multiplication operation fails, the nature of any result stored in
 * the provided pointer is undefined, as is whether a result is stored at all.
 *
 * For example, the following:
 * @code
 *     size_t some_result;
 *     int failed = guac_mem_ckd_mul(&some_result, a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a * b * c;
 * @endcode
 *
 * except that it is possible for interested callers to handle overflow.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     multiplying the given values.
 *
 * @param ...
 *     The size_t values that should be multiplied together.
 *
 * @returns
 *     Zero if the multiplication was successful and did not overflow the
 *     limits of a size_t, non-zero otherwise.
 */
#define guac_mem_ckd_mul(result, ...) \
    PRIV_guac_mem_ckd_mul(                                                    \
        result,                                                               \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Adds together each of the given values, storing the result in a size_t
 * variable via the provided pointer. If the result of the addition overflows
 * the limits of a size_t, non-zero is returned to signal failure.
 *
 * If the addition operation fails, the nature of any result stored in the
 * provided pointer is undefined, as is whether a result is stored at all.
 *
 * For example, the following:
 * @code
 *     size_t some_result;
 *     int failed = guac_mem_ckd_add(&some_result, a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a + b + c;
 * @endcode
 *
 * except that it is possible for interested callers to handle overflow.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     adding the given values.
 *
 * @param ...
 *     The size_t values that should be added together.
 *
 * @returns
 *     Zero if the addition was successful and did not overflow the limits of a
 *     size_t, non-zero otherwise.
 */
#define guac_mem_ckd_add(result, ...) \
    PRIV_guac_mem_ckd_add(                                                    \
        result,                                                               \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Subtracts each of the given values from each other, storing the result in a
 * size_t variable via the provided pointer. If the result of the subtraction
 * overflows the limits of a size_t (goes below zero), non-zero is returned to
 * signal failure.
 *
 * If the subtraction operation fails, the nature of any result stored in the
 * provided pointer is undefined, as is whether a result is stored at all.
 *
 * For example, the following:
 * @code
 *     size_t some_result;
 *     int failed = guac_mem_ckd_sub(&some_result, a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a - b - c;
 * @endcode
 *
 * except that it is possible for interested callers to handle overflow.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     subtracting the given values from each other.
 *
 * @param ...
 *     The size_t values that should be subtracted from each other.
 *
 * @returns
 *     Zero if the subtraction was successful and did not overflow the limits
 *     of a size_t (did not go below zero), non-zero otherwise.
 */
#define guac_mem_ckd_sub(result, ...) \
    PRIV_guac_mem_ckd_sub(                                                    \
        result,                                                               \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Multiplies together each of the given values, returning the result directly.
 * If the result of the multiplication overflows the limits of a size_t,
 * execution of the current process is aborted entirely, and this function does
 * not return.
 *
 * For example, the following:
 * @code
 *     size_t some_result = guac_mem_ckd_mul_or_die(a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a * b * c;
 * @endcode
 *
 * except that an overflow condition will result in the process immediately
 * terminating.
 *
 * @param ...
 *     The size_t values that should be multiplied together.
 *
 * @returns
 *     The result of the multiplication. If the multiplication operation would
 *     overflow the limits of a size_t, execution of the current process is
 *     aborted, and this function does not return.
 */
#define guac_mem_ckd_mul_or_die(...) \
    PRIV_guac_mem_ckd_mul_or_die(                                             \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Adds together each of the given values, returning the result directly. If
 * the result of the addition overflows the limits of a size_t, execution of
 * the current process is aborted entirely, and this function does not return.
 *
 * For example, the following:
 * @code
 *     size_t some_result = guac_mem_ckd_add_or_die(a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a + b + c;
 * @endcode
 *
 * except that an overflow condition will result in the process immediately
 * terminating.
 *
 * @param ...
 *     The size_t values that should be added together.
 *
 * @returns
 *     The result of the addition. If the addition operation would overflow the
 *     limits of a size_t, execution of the current process is aborted, and
 *     this function does not return.
 */
#define guac_mem_ckd_add_or_die(...) \
    PRIV_guac_mem_ckd_add_or_die(                                             \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Subtracts each of the given values from each other, returning the result
 * directly. If the result of the subtraction overflows the limits of a size_t
 * (goes below zero), execution of the current process is aborted entirely, and
 * this function does not return.
 *
 * For example, the following:
 * @code
 *     size_t some_result = guac_mem_ckd_sub_or_die(a, b, c);
 * @endcode
 *
 * is equivalent in principle to:
 * @code
 *     size_t some_result = a - b - c;
 * @endcode
 *
 * except that an overflow condition will result in the process immediately
 * terminating.
 *
 * @param ...
 *     The size_t values that should be subtracted from each other.
 *
 * @returns
 *     The result of the subtraction. If the subtraction operation would
 *     overflow the limits of a size_t (go below zero), execution of the
 *     current process is aborted, and this function does not return.
 */
#define guac_mem_ckd_sub_or_die(...) \
    PRIV_guac_mem_ckd_sub_or_die(                                             \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Reallocates a contiguous block of memory that was previously allocated with
 * guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of their
 * *_or_die() variants, returning a pointer to the first byte of that
 * reallocated block of memory. If multiple sizes are provided, these sizes are
 * multiplied together to produce the final size of the new block. If memory of
 * the specified size cannot be allocated, or if multiplying the sizes would
 * result in integer overflow, guac_error is set appropriately, the original
 * block of memory is left untouched, and NULL is returned.
 *
 * This macro is analogous to the standard realloc(), but accepts a list of
 * size factors instead of a requiring exactly one integer size.
 *
 * The returned pointer may be the same as the original pointer, but this is
 * not guaranteed. If the returned pointer is different, the original pointer
 * is automatically freed.
 *
 * The pointer returned by guac_mem_realloc() SHOULD be freed with a subsequent
 * call to guac_mem_free(), but MAY instead be freed with a subsequent call to
 * free().
 *
 * @param ...
 *     A series of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the reallocated block of memory, or NULL
 *     if such a block could not be allocated. If a block of memory could not
 *     be allocated, guac_error is set appropriately and the original block of
 *     memory is left untouched.
 */
#define guac_mem_realloc(mem, ...) \
    PRIV_guac_mem_realloc(                                                    \
        mem,                                                                  \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Reallocates a contiguous block of memory that was previously allocated with
 * guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of their
 * *_or_die() variants, returning a pointer to the first byte of that
 * reallocated block of memory. If multiple sizes are provided, these sizes are
 * multiplied together to produce the final size of the new block. If memory of
 * the specified size cannot be allocated, execution of the current process is
 * aborted entirely, and this function does not return.
 *
 * This macro is analogous to the standard realloc(), but accepts a list of
 * size factors instead of a requiring exactly one integer size and does not
 * return in the event a block cannot be allocated.
 *
 * The returned pointer may be the same as the original pointer, but this is
 * not guaranteed. If the returned pointer is different, the original pointer
 * is automatically freed.
 *
 * The pointer returned by guac_mem_realloc() SHOULD be freed with a subsequent
 * call to guac_mem_free(), but MAY instead be freed with a subsequent call to
 * free().
 *
 * @param ...
 *     A series of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the reallocated block of memory. If a
 *     block of memory could not be allocated, execution of the current process
 *     is aborted, and this function does not return.
 */
#define guac_mem_realloc_or_die(mem, ...) \
    PRIV_guac_mem_realloc_or_die(                                             \
        mem,                                                                  \
        sizeof((const size_t[]) { __VA_ARGS__ }) / sizeof(const size_t),      \
        (const size_t[]) { __VA_ARGS__ }                                      \
    )

/**
 * Frees the memory block at the given pointer, which MUST have been allocated
 * with guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of
 * their *_or_die() variants. The pointer is automatically assigned a value of
 * NULL after memory is freed. If the provided pointer is already NULL, this
 * macro has no effect.
 *
 * @param mem
 *     A pointer to the memory to be freed.
 */
#define guac_mem_free(mem) (PRIV_guac_mem_free(mem), (mem) = NULL, (void) 0)

/**
 * Frees the memory block at the given const pointer, which MUST have been
 * allocated with guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or
 * one of their *_or_die() variants. As the pointer is presumed constant, it is
 * not automatically assigned a value of NULL after memory is freed. If the
 * provided pointer is NULL, this macro has no effect.
 *
 * The guac_mem_free() macro should be used in favor of this macro. This macro
 * should only be used in cases where a constant pointer is absolutely
 * necessary.
 *
 * @param mem
 *     A pointer to the memory to be freed.
 */
#define guac_mem_free_const(mem) PRIV_guac_mem_free((void*) (mem))

#endif

