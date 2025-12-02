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

#ifndef GUAC_PRIVATE_MEM_H
#define GUAC_PRIVATE_MEM_H

/**
 * Provides functions used internally for allocating memory.
 *
 * WARNING: SYMBOLS DEFINED HERE ARE NOT INTENDED TO BE USED DIRECTLY BY
 * ANYTHING OUTSIDE LIBGUAC! This header is used internally to define private
 * symbols that are only intended for indirect public use through some other,
 * non-private mechanism, such as a macro defined in the public API.
 *
 * @file mem.h
 */

#include <stddef.h>

/**
 * Allocates a contiguous block of memory with the specified size, returning a
 * pointer to the first byte of that block of memory. If multiple sizes are
 * provided, these sizes are multiplied together to produce the final size of
 * the new block. If memory of the specified size cannot be allocated, or if
 * multiplying the sizes would result in integer overflow, guac_error is set
 * appropriately and NULL is returned.
 *
 * This function is analogous to the standard malloc(), but accepts a list of
 * size factors instead of a single integer size.
 *
 * The pointer returned by PRIV_guac_mem_alloc() SHOULD be freed with a
 * subsequent call to guac_mem_free() or PRIV_guac_mem_free(), but MAY instead
 * be freed with a subsequent call to free().
 *
 * @param factor_count
 *     The number of factors to multiply together to produce the desired block
 *     size.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the allocated block of memory, or NULL if
 *     such a block could not be allocated. If a block of memory could not be
 *     allocated, guac_error is set appropriately.
 */
void* PRIV_guac_mem_alloc(size_t factor_count, const size_t* factors);

/**
 * Allocates a contiguous block of memory with the specified size and with all
 * bytes initialized to zero, returning a pointer to the first byte of that
 * block of memory. If multiple sizes are provided, these sizes are multiplied
 * together to produce the final size of the new block. If memory of the
 * specified size cannot be allocated, or if multiplying the sizes would result
 * in integer overflow, guac_error is set appropriately and NULL is returned.
 *
 * This function is analogous to the standard calloc(), but accepts a list of
 * size factors instead of a requiring exactly two integer sizes.
 *
 * The pointer returned by PRIV_guac_mem_zalloc() SHOULD be freed with a
 * subsequent call to guac_mem_free() or PRIV_guac_mem_free(), but MAY instead
 * be freed with a subsequent call to free().
 *
 * @param factor_count
 *     The number of factors to multiply together to produce the desired block
 *     size.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the allocated block of memory, or NULL if
 *     such a block could not be allocated. If a block of memory could not be
 *     allocated, guac_error is set appropriately.
 */
void* PRIV_guac_mem_zalloc(size_t factor_count, const size_t* factors);

/**
 * Multiplies together each of the given values, storing the result in a size_t
 * variable via the provided pointer. If the result of the multiplication
 * overflows the limits of a size_t, non-zero is returned to signal failure.
 *
 * If the multiplication operation fails, the nature of any result stored in
 * the provided pointer is undefined, as is whether a result is stored at all.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     multiplying the given values.
 *
 * @param factor_count
 *     The number of factors to multiply together.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied
 *     together. At least one value MUST be provided.
 *
 * @returns
 *     Zero if the multiplication was successful and did not overflow the
 *     limits of a size_t, non-zero otherwise.
 */
int PRIV_guac_mem_ckd_mul(size_t* result, size_t factor_count, const size_t* factors);

/**
 * Adds together each of the given values, storing the result in a size_t
 * variable via the provided pointer. If the result of the addition overflows
 * the limits of a size_t, non-zero is returned to signal failure.
 *
 * If the addition operation fails, the nature of any result stored in the
 * provided pointer is undefined, as is whether a result is stored at all.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     adding the given values.
 *
 * @param term_count
 *     The number of terms to be added together.
 *
 * @param terms
 *     An array of one or more size_t values that should be added together. At
 *     least one value MUST be provided.
 *
 * @returns
 *     Zero if the addition was successful and did not overflow the limits of a
 *     size_t, non-zero otherwise.
 */
int PRIV_guac_mem_ckd_add(size_t* result, size_t term_count, const size_t* terms);

/**
 * Subtracts each of the given values from each other, storing the result in a
 * size_t variable via the provided pointer. If the result of the subtraction
 * overflows the limits of a size_t (goes below zero), non-zero is returned to
 * signal failure.
 *
 * If the subtraction operation fails, the nature of any result stored in the
 * provided pointer is undefined, as is whether a result is stored at all.
 *
 * @param result
 *     A pointer to the size_t variable that should receive the result of
 *     subtracting the given values from each other.
 *
 * @param term_count
 *     The number of terms to be subtracted from each other.
 *
 * @param terms
 *     An array of one or more size_t values that should be subtracted from
 *     each other. At least one value MUST be provided.
 *
 * @returns
 *     Zero if the subtraction was successful and did not overflow the limits
 *     of a size_t (did not go below zero), non-zero otherwise.
 */
int PRIV_guac_mem_ckd_sub(size_t* result, size_t term_count, const size_t* terms);

/**
 * Multiplies together each of the given values, returning the result directly.
 * If the result of the multiplication overflows the limits of a size_t,
 * execution of the current process is aborted entirely, and this function does
 * not return.
 *
 * @param factor_count
 *     The number of factors to multiply together.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied
 *     together. At least one value MUST be provided.
 *
 * @returns
 *     The result of the multiplication. If the multiplication operation would
 *     overflow the limits of a size_t, execution of the current process is
 *     aborted, and this function does not return.
 */
size_t PRIV_guac_mem_ckd_mul_or_die(size_t factor_count, const size_t* factors);

/**
 * Adds together each of the given values, returning the result directly. If
 * the result of the addition overflows the limits of a size_t, execution of
 * the current process is aborted entirely, and this function does not return.
 *
 * @param term_count
 *     The number of terms to be added together.
 *
 * @param terms
 *     An array of one or more size_t values that should be added together. At
 *     least one value MUST be provided.
 *
 * @returns
 *     The result of the addition. If the addition operation would overflow the
 *     limits of a size_t, execution of the current process is aborted, and
 *     this function does not return.
 */
size_t PRIV_guac_mem_ckd_add_or_die(size_t term_count, const size_t* terms);

/**
 * Subtracts each of the given values from each other, returning the result
 * directly. If the result of the subtraction overflows the limits of a size_t
 * (goes below zero), execution of the current process is aborted entirely, and
 * this function does not return.
 *
 * @param term_count
 *     The number of terms to be subtracted from each other.
 *
 * @param terms
 *     An array of one or more size_t values that should be subtracted from
 *     each other. At least one value MUST be provided.
 *
 * @returns
 *     The result of the subtraction. If the subtraction operation would
 *     overflow the limits of a size_t (go below zero), execution of the
 *     current process is aborted, and this function does not return.
 */
size_t PRIV_guac_mem_ckd_sub_or_die(size_t term_count, const size_t* terms);

/**
 * Reallocates a contiguous block of memory that was previously allocated with
 * guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of their
 * PRIV_guac_*() or *_or_die() variants, returning a pointer to the first byte
 * of that reallocated block of memory. If multiple sizes are provided, these
 * sizes are multiplied together to produce the final size of the new block. If
 * memory of the specified size cannot be allocated, or if multiplying the
 * sizes would result in integer overflow, guac_error is set appropriately, the
 * original block of memory is left untouched, and NULL is returned.
 *
 * This function is analogous to the standard realloc(), but accepts a list of
 * size factors instead of a requiring exactly one integer size.
 *
 * The returned pointer may be the same as the original pointer, but this is
 * not guaranteed. If the returned pointer is different, the original pointer
 * is automatically freed.
 *
 * The pointer returned by guac_mem_realloc() SHOULD be freed with a subsequent
 * call to guac_mem_free() or PRIV_guac_mem_free(), but MAY instead be freed
 * with a subsequent call to free().
 *
 * @param factor_count
 *     The number of factors to multiply together to produce the desired block
 *     size.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the reallocated block of memory, or NULL
 *     if such a block could not be allocated. If a block of memory could not
 *     be allocated, guac_error is set appropriately and the original block of
 *     memory is left untouched.
 */
void* PRIV_guac_mem_realloc(void* mem, size_t factor_count, const size_t* factors);

/**
 * Reallocates a contiguous block of memory that was previously allocated with
 * guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of their
 * PRIV_guac_*() or *_or_die() variants, returning a pointer to the first byte
 * of that reallocated block of memory. If multiple sizes are provided, these
 * sizes are multiplied together to produce the final size of the new block. If
 * memory of the specified size cannot be allocated, or if multiplying the
 * sizes would result in integer overflow, execution of the current process is
 * aborted entirely, and this function does not return.
 *
 * This function is analogous to the standard realloc(), but accepts a list of
 * size factors instead of a requiring exactly one integer size and does not
 * return in the event a block cannot be allocated.
 *
 * The returned pointer may be the same as the original pointer, but this is
 * not guaranteed. If the returned pointer is different, the original pointer
 * is automatically freed.
 *
 * The pointer returned by guac_mem_realloc() SHOULD be freed with a subsequent
 * call to guac_mem_free() or PRIV_guac_mem_free(), but MAY instead be freed
 * with a subsequent call to free().
 *
 * @param factor_count
 *     The number of factors to multiply together to produce the desired block
 *     size.
 *
 * @param factors
 *     An array of one or more size_t values that should be multiplied together
 *     to produce the desired block size. At least one value MUST be provided.
 *
 * @returns
 *     A pointer to the first byte of the reallocated block of memory. If a
 *     block of memory could not be allocated, execution of the current process
 *     is aborted, and this function does not return.
 */
void* PRIV_guac_mem_realloc_or_die(void* mem, size_t factor_count, const size_t* factors);

/**
 * Frees the memory block at the given pointer, which MUST have been allocated
 * with guac_mem_alloc(), guac_mem_zalloc(), guac_mem_realloc(), or one of
 * their PRIV_guac_*() or *_or_die() variants. If the provided pointer is NULL,
 * this function has no effect.
 *
 * @param mem
 *     A pointer to the memory to be freed.
 */
void PRIV_guac_mem_free(void* mem);

#endif

