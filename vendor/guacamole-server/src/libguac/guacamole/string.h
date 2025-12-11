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

#ifndef GUAC_STRING_H
#define GUAC_STRING_H

/**
 * Provides convenience functions for manipulating strings.
 *
 * @file string.h
 */

#include <stddef.h>
#include <string.h>

/**
 * Convert the provided unsigned integer into a string, returning the number of
 * characters written into the destination string, or a negative value if an
 * error occurs.
 *
 * @param dest
 *     The destination string to copy the data into, which should already be
 *     allocated and at a size that can handle the string representation of the
 *     inteer.
 *
 * @param integer
 *     The unsigned integer to convert to a string.
 * 
 * @return
 *     The number of characters written into the dest string.
 */
int guac_itoa(char* restrict dest, unsigned int integer);

/**
 * Copies a limited number of bytes from the given source string to the given
 * destination buffer. The resulting buffer will always be null-terminated,
 * even if doing so means that the intended string is truncated, unless the
 * destination buffer has no space available at all. As this function always
 * returns the length of the string it tried to create (the length of the
 * source string), whether truncation has occurred can be detected by comparing
 * the return value against the size of the destination buffer. If the value
 * returned is greater than or equal to the size of the destination buffer, then
 * the string has been truncated.
 *
 * The source and destination buffers MAY NOT overlap.
 *
 * @param dest
 *     The buffer which should receive the contents of the source string. This
 *     buffer will always be null terminated unless zero bytes are available
 *     within the buffer.
 *
 * @param src
 *     The source string to copy into the destination buffer. This string MUST
 *     be null terminated.
 *
 * @param n
 *     The number of bytes available within the destination buffer. If this
 *     value is zero, no bytes will be written to the destination buffer, and
 *     the destination buffer may not be null terminated. In all other cases,
 *     the destination buffer will always be null terminated, even if doing
 *     so means that the copied data from the source string will be truncated.
 *
 * @return
 *     The length of the copied string (the source string) in bytes, excluding
 *     the null terminator.
 */
size_t guac_strlcpy(char* restrict dest, const char* restrict src, size_t n);

/**
 * Appends the given source string after the end of the given destination
 * string, writing at most the given number of bytes. Both the source and
 * destination strings MUST be null-terminated. The resulting buffer will
 * always be null-terminated, even if doing so means that the intended string
 * is truncated, unless the destination buffer has no space available at all.
 * As this function always returns the length of the string it tried to create
 * (the length of destination and source strings added together), whether
 * truncation has occurred can be detected by comparing the return value
 * against the size of the destination buffer. If the value returned is greater
 * than or equal to the size of the destination buffer, then the string has
 * been truncated.
 *
 * The source and destination buffers MAY NOT overlap.
 *
 * @param dest
 *     The buffer which should be appended with the contents of the source
 *     string. This buffer MUST already be null-terminated and will always be
 *     null-terminated unless zero bytes are available within the buffer.
 *
 *     As a safeguard against incorrectly-written code, in the event that the
 *     destination buffer is not null-terminated, this function will still stop
 *     before overrunning the buffer, instead behaving as if the length of the
 *     string in the buffer is exactly the size of the buffer. The destination
 *     buffer will remain untouched (and unterminated) in this case.
 *
 * @param src
 *     The source string to append to the destination buffer. This string
 *     MUST be null-terminated.
 *
 * @param n
 *     The number of bytes available within the destination buffer. If this
 *     value is not greater than zero, no bytes will be written to the
 *     destination buffer, and the destination buffer may not be
 *     null-terminated. In all other cases, the destination buffer will always
 *     be null-terminated, even if doing so means that the copied data from the
 *     source string will be truncated.
 *
 * @return
 *     The length of the string this function tried to create (the lengths of
 *     the source and destination strings added together) in bytes, excluding
 *     the null terminator.
 */
size_t guac_strlcat(char* restrict dest, const char* restrict src, size_t n);

/**
 * Search for the null-terminated string needle in the possibly null-
 * terminated haystack, looking at no more than len bytes.
 *
 * @param haystack
 *     The string to search. It may or may not be null-terminated. Only the
 *     first len bytes are searched.
 *
 * @param needle
 *     The string to look for. It must be null-terminated.
 *
 * @param len
 *     The maximum number of bytes to examine in haystack.
 *
 * @return
 *     A pointer to the first instance of needle within haystack, or NULL if
 *     needle does not exist in haystack. If needle is the empty string,
 *     haystack is returned.
 *
 */
char* guac_strnstr(const char *haystack, const char *needle, size_t len);

/**
 * Duplicates up to the given number of characters from the provided string,
 * returning a newly-allocated string containing the copied contents. The
 * provided string must be null-terminated, and only the first 'n' characters
 * will be considered for duplication, or the full string length if it is
 * shorter than 'n'. The memory block for the newly-allocated string will
 * include enough space for these characters, as well as for the null
 * terminator.
 *
 * The pointer returned by guac_strndup() SHOULD be freed with a subsequent call
 * to guac_mem_free(), but MAY instead be freed with a subsequent call to free().
 *
 * This function behaves similarly to the POSIX strndup() function, except that
 * NULL will be returned if the provided string is NULL or if memory allocation
 * fails. Also, the length of the string to be duplicated will be checked to
 * prevent overflow if adding space for the null terminator.
 *
 * @param str
 *     The string of which up to the first 'n' characters should be duplicated
 *     as a newly-allocated string. If 'n' exceeds the length of the string,
 *     the entire string is duplicated.
 *
 * @param n
 *     The maximum number of characters to duplicate from the given string.
 *
 * @return
 *     A newly-allocated string containing up to the first 'n' characters from
 *     the given string, including a terminating null byte, or NULL if the
 *     provided string was NULL or if memory allocation fails.
 */
char* guac_strndup(const char* str, size_t n);

/**
 * Duplicates the given string, returning a newly-allocated string containing
 * the same contents. The provided string must be null-terminated. The size of
 * the memory block for the newly-allocated string is only guaranteed to
 * include enough space for the contents of the provided string, including null
 * terminator.
 *
 * The pointer returned by guac_strdup() SHOULD be freed with a subsequent call
 * to guac_mem_free(), but MAY instead be freed with a subsequent call to free().
 *
 * This function behaves identically to standard strdup(), except that NULL
 * will be returned if the provided string is NULL.
 *
 * @param str
 *     The string to duplicate as a newly-allocated string.
 *
 * @return
 *     A newly-allocated string containing identically the same content as the
 *     given string, or NULL if the given string was NULL.
 */
char* guac_strdup(const char* str);

/**
 * Concatenates each of the given strings, separated by the given delimiter,
 * storing the result within a destination buffer. The number of bytes written
 * will be no more than the given number of bytes, and the destination buffer
 * is guaranteed to be null-terminated, even if doing so means that one or more
 * of the intended strings are truncated or omitted from the end of the result,
 * unless the destination buffer has no space available at all. As this
 * function always returns the length of the string it tried to create (the
 * length of all source strings and all delimiters added together), whether
 * truncation has occurred can be detected by comparing the return value
 * against the size of the destination buffer. If the value returned is greater
 * than or equal to the size of the destination buffer, then the string has
 * been truncated.
 *
 * The source strings, delimiter string, and destination buffer MAY NOT
 * overlap.
 *
 * @param dest
 *     The buffer which should receive the result of joining the given strings.
 *     This buffer will always be null terminated unless zero bytes are
 *     available within the buffer.
 *
 * @param elements
 *     The elements to concatenate together, separated by the given delimiter.
 *     Each element MUST be null-terminated.
 *
 * @param nmemb
 *     The number of elements within the elements array.
 *
 * @param delim
 *     The delimiter to include between each pair of elements.
 *
 * @param n
 *     The number of bytes available within the destination buffer. If this
 *     value is not greater than zero, no bytes will be written to the
 *     destination buffer, and the destination buffer may not be null
 *     terminated. In all other cases, the destination buffer will always be
 *     null terminated, even if doing so means that the result will be
 *     truncated.
 *
 * @return
 *     The length of the string this function tried to create (the length of
 *     all source strings and all delimiters added together) in bytes,
 *     excluding the null terminator.
 */
size_t guac_strljoin(char* restrict dest, const char* restrict const* elements,
        int nmemb, const char* restrict delim, size_t n);

#endif
