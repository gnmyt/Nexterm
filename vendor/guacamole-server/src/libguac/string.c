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

#include "config.h"

#include "guacamole/mem.h"

#include <stddef.h>
#include <stdio.h>
#include <string.h>

/**
 * Returns the space remaining in a buffer assuming that the given number of
 * bytes have already been written. If the number of bytes exceeds the size
 * of the buffer, zero is returned.
 *
 * @param n
 *     The size of the buffer in bytes.
 *
 * @param length
 *     The number of bytes which have been written to the buffer so far. If
 *     the routine writing the bytes will automatically truncate its writes,
 *     this value may exceed the size of the buffer.
 *
 * @return
 *     The number of bytes remaining in the buffer. This value will always
 *     be non-negative. If the number of bytes written already exceeds the
 *     size of the buffer, zero will be returned.
 */
#define REMAINING(n, length) (((n) < (length)) ? 0 : ((n) - (length)))

int guac_itoa(char* restrict dest, unsigned int integer) {

    /* Determine size of string. */
    int str_size = snprintf(dest, 0, "%i", integer);

    /* If an error occurs, just return that and skip the conversion. */
    if (str_size < 0)
        return str_size;

    /* Do the conversion and return. */
    return snprintf(dest, (str_size + 1), "%i", integer);

}

size_t guac_strlcpy(char* restrict dest, const char* restrict src, size_t n) {

#ifdef HAVE_STRLCPY
    return strlcpy(dest, src, n);
#else
    /* Calculate actual length of desired string */
    size_t length = strlen(src);

    /* Copy nothing if there is no space */
    if (n == 0)
        return length;

    /* Calculate length of the string which will be copied */
    size_t copy_length = length;
    if (copy_length >= n)
        copy_length = n - 1;

    /* Copy only as much of string as possible, manually adding a null
     * terminator */
    memcpy(dest, src, copy_length);
    dest[copy_length] = '\0';

    /* Return the overall length of the desired string */
    return length;
#endif

}

size_t guac_strlcat(char* restrict dest, const char* restrict src, size_t n) {

#ifdef HAVE_STRLCPY
    return strlcat(dest, src, n);
#else
    size_t length = strnlen(dest, n);
    return length + guac_strlcpy(dest + length, src, REMAINING(n, length));
#endif

}

char* guac_strnstr(const char *haystack, const char *needle, size_t len) {

#ifdef HAVE_STRNSTR
    return strnstr(haystack, needle, len);
#else
    char* chr;
    size_t nlen = strlen(needle), off = 0;

    /* Follow documented API: return haystack if needle is the empty string. */
    if (nlen == 0)
        return (char *)haystack;

    /* Use memchr to find candidates. It might be optimized in asm. */
    while (off < len && NULL != (chr = memchr(haystack + off, needle[0], len - off))) {
        /* chr is guaranteed to be in bounds of and >= haystack. */
        off = chr - haystack;
        /* If needle would go beyond provided len, it doesn't exist in haystack. */
        if (off + nlen > len)
            return NULL;
        /* Now that we know we have at least nlen bytes, compare them. */
        if (!memcmp(chr, needle, nlen))
            return chr;
        /* Make sure we make progress. */
        off += 1;
    }

    /* memchr ran out of candidates, needle wasn't found. */
    return NULL;
#endif

}

char* guac_strndup(const char* str, size_t n) {

    /* Return NULL if no string provided */
    if (str == NULL)
        return NULL;

    /* Do not attempt to duplicate if the length is somehow magically so
     * obscenely large that it will not be possible to add a null terminator */
    size_t length;
    size_t length_to_copy = strnlen(str, n);
    if (guac_mem_ckd_add(&length, length_to_copy, 1))
        return NULL;

    /* Otherwise just copy to a new string in same manner as strndup() */
    char* new_str = (char*)guac_mem_alloc(length);
    if (new_str != NULL) {
        memcpy(new_str, str, length_to_copy);
        new_str[length_to_copy] = '\0';
    }

    return new_str;

}

char* guac_strdup(const char* str) {

    /* Return NULL if no string provided */
    if (str == NULL)
        return NULL;

    return guac_strndup(str, strlen(str));
}

size_t guac_strljoin(char* restrict dest, const char* restrict const* elements,
        int nmemb, const char* restrict delim, size_t n) {

    size_t length = 0;
    const char* restrict const* current = elements;

    /* If no elements are provided, nothing to do but ensure the destination
     * buffer is null terminated */
    if (nmemb <= 0)
        return guac_strlcpy(dest, "", n);

    /* Initialize destination buffer with first element */
    length += guac_strlcpy(dest, *current, n);

    /* Copy all remaining elements, separated by delimiter */
    for (current++; nmemb > 1; current++, nmemb--) {
        length += guac_strlcat(dest + length, delim, REMAINING(n, length));
        length += guac_strlcat(dest + length, *current, REMAINING(n, length));
    }

    return length;

}
