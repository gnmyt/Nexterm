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

package org.apache.guacamole.vault.secret;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Caching implementation of VaultSecretService. Requests for the values of
 * secrets will automatically be cached for a duration determined by the
 * implementation. Subclasses must implement refreshCachedSecret() to provide
 * a mechanism for CachedVaultSecretService to explicitly retrieve a value
 * which is missing from the cache or has expired.
 */
public abstract class CachedVaultSecretService implements VaultSecretService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(CachedVaultSecretService.class);

    /**
     * The cached value of a secret.
     */
    protected class CachedSecret {

        /**
         * A Future which contains or will contain the value of the secret at
         * the time it was last retrieved.
         */
        private final Future<String> value;

        /**
         * The time the value should be considered out-of-date, in milliseconds
         * since midnight of January 1, 1970 UTC.
         */
        private final long expires;

        /**
         * Creates a new CachedSecret which represents a cached snapshot of the
         * value of a secret. Each CachedSecret has a limited lifespan after
         * which it should be considered out-of-date.
         *
         * @param value
         *     A Future which contains or will contain the current value of the
         *     secret. If no such secret exists, the given Future should
         *     complete with null.
         *
         * @param ttl
         *     The maximum number of milliseconds that this value should be
         *     cached.
         */
        public CachedSecret(Future<String> value, int ttl) {
            this.value = value;
            this.expires = System.currentTimeMillis() + ttl;
        }

        /**
         * Returns the value of the secret at the time it was last retrieved.
         * The actual value of the secret may have changed.
         *
         * @return
         *     A Future which will eventually complete with the value of the
         *     secret at the time it was last retrieved. If no such secret
         *     exists, the Future will be completed with null. If an error
         *     occurs which prevents retrieval of the secret, that error will
         *     be exposed through an ExecutionException when an attempt is made
         *     to retrieve the value from the Future.
         */
        public Future<String> getValue() {
            return value;
        }

        /**
         * Returns whether this specific cached value has expired. Expired
         * values will be automatically refreshed by CachedVaultSecretService.
         *
         * @return
         *     true if this cached value has expired, false otherwise.
         */
        public boolean isExpired() {
            return System.currentTimeMillis() >= expires;
        }

    }

    /**
     * Cache of past requests to retrieve secrets. Expired secrets are lazily
     * removed.
     */
    private final ConcurrentHashMap<String, Future<CachedSecret>> cache = new ConcurrentHashMap<>();

    /**
     * Explicitly retrieves the value of the secret having the given name,
     * returning a result that can be cached. The length of time that this
     * specific value will be cached is determined by the TTL value provided to
     * the returned CachedSecret. This function will be automatically invoked
     * in response to calls to getValue() when the requested secret is either
     * not cached or has expired. Expired secrets are not removed from the
     * cache until another request is made for that secret.
     *
     * @param name
     *     The name of the secret to retrieve.
     *
     * @return
     *     A CachedSecret which defines the current value of the secret and the
     *     point in time that value should be considered potentially
     *     out-of-date.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the secret from the vault.
     */
    protected abstract CachedSecret refreshCachedSecret(String name)
            throws GuacamoleException;

    @Override
    public Future<String> getValue(String name) throws GuacamoleException {

        CompletableFuture<CachedSecret> refreshEntry;

        try {

            // Attempt to use cached result of previous call
            Future<CachedSecret> cachedEntry = cache.get(name);
            if (cachedEntry != null) {

                // Use cached result if not yet expired
                CachedSecret secret = cachedEntry.get();
                if (!secret.isExpired()) {
                    logger.debug("Using cached secret for \"{}\".", name);
                    return secret.getValue();
                }

                // Evict if expired
                else {
                    logger.debug("Cached secret for \"{}\" is expired.", name);
                    cache.remove(name, cachedEntry);
                }

            }

            // If no cached result, or result is too old, race with other
            // threads to be the thread which refreshes the entry
            refreshEntry = new CompletableFuture<>();
            cachedEntry = cache.putIfAbsent(name, refreshEntry);

            // If a refresh operation is already in progress, wait for that
            // operation to complete and use its value
            if (cachedEntry != null)
                return cachedEntry.get().getValue();

        }
        catch (InterruptedException | ExecutionException e) {
            throw new GuacamoleServerException("Attempt to retrieve secret "
                    + "failed.", e);
        }

        // If we reach this far, the cache entry is stale or missing, and it's
        // this thread's responsibility to refresh the entry
        try {
            CachedSecret secret = refreshCachedSecret(name);
            refreshEntry.complete(secret);
            logger.debug("Cached secret for \"{}\" will be refreshed.", name);
            return secret.getValue();
        }

        // Abort the refresh operation if an error occurs
        catch (Error | RuntimeException | GuacamoleException e) {
            refreshEntry.completeExceptionally(e);
            cache.remove(name, refreshEntry);
            logger.debug("Cached secret for \"{}\" could not be refreshed.", name);
            throw e;
        }

    }

}
