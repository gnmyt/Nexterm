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

package org.apache.guacamole.vault.ksm.secret;

import com.google.inject.Inject;
import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import com.keepersecurity.secretsManager.core.Hosts;
import com.keepersecurity.secretsManager.core.KeeperRecord;
import com.keepersecurity.secretsManager.core.KeeperSecrets;
import com.keepersecurity.secretsManager.core.Login;
import com.keepersecurity.secretsManager.core.Notation;
import com.keepersecurity.secretsManager.core.SecretsManager;
import com.keepersecurity.secretsManager.core.SecretsManagerOptions;

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.annotation.Nullable;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.vault.ksm.conf.KsmConfigurationService;
import org.apache.guacamole.vault.secret.WindowsUsername;
import org.apache.guacamole.vault.ksm.GuacamoleExceptionSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Client which retrieves records from Keeper Secrets Manager, allowing
 * content-based record retrieval. Note that because KSM is zero-knowledge,
 * searching or indexing based on content can only be accomplished by
 * retrieving and indexing everything. Except for record UIDs (which contain no
 * information), it's not possible for the server to perform a search of
 * content on the client's behalf. The client has to perform its own search.
 */
public class KsmClient {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(KsmClient.class);

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private KsmConfigurationService confService;

    /**
     * Service for retrieving data from records.
     */
    @Inject
    private KsmRecordService recordService;

    /**
     * The publicly-accessible URL for Keeper's documentation covering Keeper
     * notation.
     */
    private static final String KEEPER_NOTATION_DOC_URL =
            "https://docs.keeper.io/secrets-manager/secrets-manager/about/keeper-notation";

    /**
     * The regular expression that Keeper notation must match to be related to
     * file retrieval. As the Keeper SDK provides mutually-exclusive for
     * retrieving secret values and files via notation, the notation must first
     * be tested to determine whether it refers to a file.
     */
    private static final Pattern KEEPER_FILE_NOTATION = Pattern.compile("^(keeper://)?[^/]*/file/.+");

    /**
     * The KSM configuration associated with this client instance.
     */
    private final SecretsManagerOptions ksmConfig;

    /**
     * Read/write lock which guards access to all cached data, including the
     * timestamp recording the last time the cache was refreshed. Readers of
     * the cache must first acquire (and eventually release) the read lock, and
     * writers of the cache must first acquire (and eventually release) the
     * write lock.
     */
    private final ReadWriteLock cacheLock = new ReentrantReadWriteLock();

    /**
     * The maximum amount of time that an entry will be stored in the cache
     * before being refreshed, in milliseconds. This is also the shortest
     * possible interval between API calls to KSM.
     */
    private final long cacheInterval;

    /**
     * The timestamp that the cache was last refreshed, in milliseconds, as
     * returned by System.currentTimeMillis(). This value is automatically
     * updated if {@link #validateCache()} refreshes the cache. This value must
     * not be accessed without {@link #cacheLock} acquired appropriately.
     */
    private volatile long cacheTimestamp = 0;

    /**
     * The full cached set of secrets last retrieved from Keeper Secrets
     * Manager. This value is automatically updated if {@link #validateCache()}
     * refreshes the cache. This value must not be accessed without
     * {@link #cacheLock} acquired appropriately.
     */
    private KeeperSecrets cachedSecrets = null;

    /**
     * All records retrieved from Keeper Secrets Manager, where each key is the
     * UID of the corresponding record. The contents of this Map are
     * automatically updated if {@link #validateCache()} refreshes the cache.
     * This Map must not be accessed without {@link #cacheLock} acquired
     * appropriately.
     */
    private final Map<String, KeeperRecord> cachedRecordsByUid = new HashMap<>();

    /**
     * All records retrieved from Keeper Secrets Manager, where each key is the
     * hostname or IP address of the corresponding record. The hostname or IP
     * address of a record is determined by {@link Hosts} fields, thus a record
     * may be associated with multiple hosts. If a record is associated with
     * multiple hosts, there will be multiple references to that record within
     * this Map. The contents of this Map are automatically updated if
     * {@link #validateCache()} refreshes the cache. This Map must not be
     * accessed without {@link #cacheLock} acquired appropriately. Before using
     * a value from this Map, {@link #cachedAmbiguousHosts} must first be
     * checked to verify that there is indeed only one record associated with
     * that host.
     */
    private final Map<String, KeeperRecord> cachedRecordsByHost = new HashMap<>();

    /**
     * The set of all hostnames or IP addresses that are associated with
     * multiple records, and thus cannot uniquely identify a record. The
     * contents of this Set are automatically updated if
     * {@link #validateCache()} refreshes the cache. This Set must not be
     * accessed without {@link #cacheLock} acquired appropriately.This Set
     * must be checked before using a value retrieved from
     * {@link #cachedRecordsByHost}.
     */
    private final Set<String> cachedAmbiguousHosts = new HashSet<>();

    /**
     * All records retrieved from Keeper Secrets Manager, where each key is the
     * username/domain of the corresponding record. The username of a record is
     * determined by {@link Login} and "domain" fields, thus a record may be
     * associated with multiple users. If a record is associated with multiple
     * users, there will be multiple references to that record within this Map.
     * The contents  of this Map are automatically updated if
     * {@link #validateCache()} refreshes the cache. This Map must not be accessed
     * without {@link #cacheLock} acquired appropriately. Before using a value from
     * this Map, {@link #cachedAmbiguousUsers} must first be checked to
     * verify that there is indeed only one record associated with that user.
     */
    private final Map<UserLogin, KeeperRecord> cachedRecordsByUser = new HashMap<>();

    /**
     * The set of all username/domain combos that are associated with multiple
     * records, and thus cannot uniquely identify a record. The contents of
     * this Set are automatically updated if {@link #validateCache()} refreshes
     * the cache. This Set must not be accessed without {@link #cacheLock}
     * acquired appropriately. This Set must be checked before using a value
     * retrieved from {@link #cachedRecordsByUser}.
     */
    private final Set<UserLogin> cachedAmbiguousUsers = new HashSet<>();

    /**
     * All records retrieved from Keeper Secrets Manager, where each key is the
     * domain of the corresponding record. The domain of a record is
     * determined by {@link Login} fields, thus a record may be associated with
     * multiple domains. If a record is associated with multiple domains, there
     * will be multiple references to that record within this Map. The contents
     * of this Map are automatically updated if {@link #validateCache()}
     * refreshes the cache. This Map must not be accessed without
     * {@link #cacheLock} acquired appropriately. Before using a value from
     * this Map, {@link #cachedAmbiguousDomains} must first be checked to
     * verify that there is indeed only one record associated with that domain.
     */
    private final Map<String, KeeperRecord> cachedRecordsByDomain = new HashMap<>();

    /**
     * The set of all domains that are associated with multiple records, and
     * thus cannot uniquely identify a record. The contents of this Set are
     * automatically updated if {@link #validateCache()} refreshes the cache.
     * This Set must not be accessed without {@link #cacheLock} acquired
     * appropriately. This Set must be checked before using a value retrieved
     * from {@link #cachedRecordsByDomain}.
     */
    private final Set<String> cachedAmbiguousDomains = new HashSet<>();

    /**
     * Create a new KSM client based around the provided KSM configuration and
     * API timeout setting.
     *
     * @param ksmConfig
     *     The KSM configuration to use when retrieving properties from KSM.
     *
     * @param apiInterval
     *     The minimum number of milliseconds that must elapse between KSM API
     *     calls.
     */
    @AssistedInject
    public KsmClient(
            @Assisted SecretsManagerOptions ksmConfig,
            @Assisted long apiInterval) {
        this.ksmConfig = ksmConfig;
        this.cacheInterval = apiInterval;
    }

    /**
     * Validates that all cached data is current with respect to
     * {@link #cacheInterval}, refreshing data from the server as needed.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing the cached data from being refreshed.
     */
    private void validateCache() throws GuacamoleException {

        long currentTime = System.currentTimeMillis();

        // Perform a read-only check that the cache has actually expired before
        // continuing
        cacheLock.readLock().lock();
        try {
            if (currentTime - cacheTimestamp < cacheInterval)
                return;
        }
        finally {
            cacheLock.readLock().unlock();
        }

        cacheLock.writeLock().lock();
        try {

            // Cache may have been updated since the read-only check. Re-verify
            // that the cache has expired before continuing with a full refresh
            if (currentTime - cacheTimestamp < cacheInterval)
                return;

            // Attempt to pull all records first, allowing that operation to
            // succeed/fail BEFORE we clear out the last cached success
            KeeperSecrets secrets = SecretsManager.getSecrets(ksmConfig);
            List<KeeperRecord> records = secrets.getRecords();

            // Store all secrets within cache
            cachedSecrets = secrets;

            // Clear unambiguous cache of all records by UID
            cachedRecordsByUid.clear();

            // Clear cache of host-based records
            cachedAmbiguousHosts.clear();
            cachedRecordsByHost.clear();

            // Clear cache of login-based records
            cachedAmbiguousUsers.clear();
            cachedRecordsByUser.clear();

            // Clear cache of domain-based records
            cachedAmbiguousDomains.clear();
            cachedRecordsByDomain.clear();

            // Parse configuration
            final boolean shouldSplitUsernames = confService.getSplitWindowsUsernames();
            final boolean shouldMatchByDomain = confService.getMatchUserRecordsByDomain();

            // Store all records, sorting each into host-based, login-based,
            // and domain-based buckets
            records.forEach(record -> {

                // Store based on UID ...
                cachedRecordsByUid.put(record.getRecordUid(), record);

                // ... and hostname/address
                String hostname = recordService.getHostname(record);
                addRecordForHost(record, hostname);

                // ... and domain
                String domain = recordService.getDomain(record);
                addRecordForDomain(record, domain);

                // Get the username off of the record
                String username = recordService.getUsername(record);

                // If we have a username, and there isn't already a domain explicitly defined
                if (username != null && domain == null && shouldSplitUsernames) {

                    // Attempt to split out the domain of the username
                    WindowsUsername usernameAndDomain = (
                            WindowsUsername.splitWindowsUsernameFromDomain(username));

                    // Use the username-split domain if available
                    if (usernameAndDomain.hasDomain()) {
                        domain = usernameAndDomain.getDomain();
                        username = usernameAndDomain.getUsername();
                        addRecordForDomain(record, domain);
                    }

                }

                // If domain matching is not enabled for user records,
                // explicitly set all domains to null to allow matching
                // on username only
                if (!shouldMatchByDomain)
                    domain = null;

                // Store based on login ONLY if no hostname (will otherwise
                // result in ambiguous entries for servers tied to identical
                // accounts)
                if (hostname == null)
                    addRecordForLogin(record, username, domain);

            });

            // Cache has been refreshed
            this.cacheTimestamp = System.currentTimeMillis();

        }
        finally {
            cacheLock.writeLock().unlock();
        }

    }

    /**
     * Associates the given record with the given domain. The domain may be
     * null. Both {@link #cachedRecordsByDomain} and {@link #cachedAmbiguousDomains}
     * are updated appropriately. The write lock of {@link #cacheLock} must
     * already be acquired before invoking this function.
     *
     * @param record
     *     The record to associate with the domains in the given field.
     *
     * @param domain
     *     The domain that the given record should be associated with.
     *     This may be null.
     */
    private void addRecordForDomain(KeeperRecord record, String domain) {

        if (domain == null)
            return;

        KeeperRecord existing = cachedRecordsByDomain.putIfAbsent(domain, record);
        if (existing != null && record != existing)
            cachedAmbiguousDomains.add(domain);

    }

    /**
     * Associates the given record with the given hostname. The hostname may be
     * null. Both {@link #cachedRecordsByHost} and {@link #cachedAmbiguousHosts}
     * are updated appropriately. The write lock of {@link #cacheLock} must
     * already be acquired before invoking this function.
     *
     * @param record
     *     The record to associate with the hosts in the given field.
     *
     * @param hostname
     *     The hostname/address that the given record should be associated
     *     with. This may be null.
     */
    private void addRecordForHost(KeeperRecord record, String hostname) {

        if (hostname == null)
            return;

        KeeperRecord existing = cachedRecordsByHost.putIfAbsent(hostname, record);
        if (existing != null && record != existing)
            cachedAmbiguousHosts.add(hostname);

    }

    /**
     * Associates the given record with the given user, and optional domain.
     * The given username or domain may be null. Both {@link #cachedRecordsByUser}
     * and {@link #cachedAmbiguousUsers} are updated appropriately. The write
     * lock of {@link #cacheLock} must already be acquired before invoking this
     * function.
     *
     * @param record
     *     The record to associate with the given user.
     *
     * @param username
     *     The username that the given record should be associated with. This
     *     may be null.
     *
     * @param domain
     *     The domain that the given record should be associated with. This
     *     may be null.
     */
    private void addRecordForLogin(
            KeeperRecord record, String username, String domain) {

        if (username == null)
            return;

        UserLogin userDomain = new UserLogin(username, domain);
        KeeperRecord existing = cachedRecordsByUser.putIfAbsent(
                userDomain, record);
        if (existing != null && record != existing)
            cachedAmbiguousUsers.add(userDomain);

    }

    /**
     * Returns all records accessible via Keeper Secrets Manager. The records
     * returned are arbitrarily ordered.
     *
     * @return
     *     An unmodifiable Collection of all records accessible via Keeper
     *     Secrets Manager,  in no particular order.
     *
     * @throws GuacamoleException
     *     If an error occurs that prevents records from being retrieved.
     */
    public Collection<KeeperRecord> getRecords() throws GuacamoleException {
        validateCache();
        cacheLock.readLock().lock();
        try {
            return Collections.unmodifiableCollection(cachedRecordsByUid.values());
        }
        finally {
            cacheLock.readLock().unlock();
        }
    }

    /**
     * Returns the record having the given UID. If no such record exists, null
     * is returned.
     *
     * @param uid
     *     The UID of the record to return.
     *
     * @return
     *     The record having the given UID, or null if there is no such record.
     *
     * @throws GuacamoleException
     *     If an error occurs that prevents the record from being retrieved.
     */
    public KeeperRecord getRecord(String uid) throws GuacamoleException {
        validateCache();
        cacheLock.readLock().lock();
        try {
            return cachedRecordsByUid.get(uid);
        }
        finally {
            cacheLock.readLock().unlock();
        }
    }

    /**
     * Returns the record associated with the given hostname or IP address. If
     * no such record exists, or there are multiple such records, null is
     * returned.
     *
     * @param hostname
     *     The hostname of the record to return.
     *
     * @return
     *     The record associated with the given hostname, or null if there is
     *     no such record or multiple such records.
     *
     * @throws GuacamoleException
     *     If an error occurs that prevents the record from being retrieved.
     */
    public KeeperRecord getRecordByHost(String hostname) throws GuacamoleException {
        validateCache();
        cacheLock.readLock().lock();
        try {

            if (cachedAmbiguousHosts.contains(hostname)) {
                logger.debug("The hostname/address \"{}\" is referenced by "
                        + "multiple Keeper records and cannot be used to "
                        + "locate individual secrets.", hostname);
                return null;
            }

            return cachedRecordsByHost.get(hostname);

        }
        finally {
            cacheLock.readLock().unlock();
        }
    }

    /**
     * Returns the record associated with the given username and domain. If no
     * such record exists, or there are multiple such records, null is returned.
     *
     * @param username
     *     The username of the record to return.
     *
     * @param domain
     *     The domain of the record to return, or null if no domain exists.
     *
     * @return
     *     The record associated with the given username and domain, or null
     *     if there is no such record or multiple such records.
     *
     * @throws GuacamoleException
     *     If an error occurs that prevents the record from being retrieved.
     */
    public KeeperRecord getRecordByLogin(
            String username, String domain) throws GuacamoleException {

        validateCache();
        cacheLock.readLock().lock();

        UserLogin userDomain = new UserLogin(username, domain);

        try {

            if (cachedAmbiguousUsers.contains(userDomain)) {
                logger.debug("The username \"{}\" with domain \"{}\" is "
                        + "referenced by multiple Keeper records and "
                        + "cannot be used to locate individual secrets.",
                        username, domain);
                return null;
            }

            return cachedRecordsByUser.get(userDomain);

        }
        finally {
            cacheLock.readLock().unlock();
        }
    }

    /**
     * Returns the record associated with the given domain. If no such record
     * exists, or there are multiple such records, null is returned.
     *
     * @param domain
     *     The domain of the record to return.
     *
     * @return
     *     The record associated with the given domain, or null if there is
     *     no such record or multiple such records.
     *
     * @throws GuacamoleException
     *     If an error occurs that prevents the record from being retrieved.
     */
    public KeeperRecord getRecordByDomain(String domain) throws GuacamoleException {
        validateCache();
        cacheLock.readLock().lock();
        try {

            if (cachedAmbiguousDomains.contains(domain)) {
                logger.debug("The domain \"{}\" is referenced by multiple "
                        + "Keeper records and cannot be used to locate "
                        + "individual secrets.", domain);
                return null;
            }

            return cachedRecordsByDomain.get(domain);

        }
        finally {
            cacheLock.readLock().unlock();
        }
    }

    /**
     * Returns the value of the secret stored within Keeper Secrets Manager and
     * represented by the given Keeper notation. Keeper notation locates the
     * value of a specific field, custom field, or file associated with a
     * specific record. See: https://docs.keeper.io/secrets-manager/secrets-manager/about/keeper-notation
     *
     * @param notation
     *     The Keeper notation of the secret to retrieve.
     *
     * @return
     *     A Future which completes with the value of the secret represented by
     *     the given Keeper notation, or null if there is no such secret.
     *
     * @throws GuacamoleException
     *     If the requested secret cannot be retrieved or the Keeper notation
     *     is invalid.
     */
    public Future<String> getSecret(String notation) throws GuacamoleException {
        return getSecret(notation, null);
    }

    /**
     * Returns the value of the secret stored within Keeper Secrets Manager and
     * represented by the given Keeper notation. Keeper notation locates the
     * value of a specific field, custom field, or file associated with a
     * specific record. See: https://docs.keeper.io/secrets-manager/secrets-manager/about/keeper-notation
     * If a fallbackFunction is provided, it will be invoked to generate
     * a return value in the case where no secret is found with the given
     * keeper notation.
     *
     * @param notation
     *     The Keeper notation of the secret to retrieve.
     *
     * @param fallbackFunction
     *     A function to invoke in order to produce a Future for return,
     *     if the requested secret is not found. If the provided Function
     *     is null, it will not be run.
     *
     * @return
     *     A Future which completes with the value of the secret represented by
     *     the given Keeper notation, or null if there is no such secret.
     *
     * @throws GuacamoleException
     *     If the requested secret cannot be retrieved or the Keeper notation
     *     is invalid.
     */
    public Future<String> getSecret(
            String notation,
            @Nullable GuacamoleExceptionSupplier<Future<String>> fallbackFunction)
            throws GuacamoleException {
        validateCache();
        cacheLock.readLock().lock();
        try {

            // Retrieve any relevant file asynchronously
            Matcher fileNotationMatcher = KEEPER_FILE_NOTATION.matcher(notation);
            if (fileNotationMatcher.matches())
                return recordService.download(Notation.getFile(cachedSecrets, notation));

            // Retrieve string values synchronously
            return CompletableFuture.completedFuture(Notation.getValue(cachedSecrets, notation));

        }

        // Unfortunately, the notation parser within the Keeper SDK throws
        // plain Errors for retrieval failures ...
        catch (Error e) {
            logger.warn("Record \"{}\" does not exist.", notation);
            logger.debug("Retrieval of record by Keeper notation failed.", e);

            // If the secret is not found, invoke the fallback function
            if (fallbackFunction != null)
                return fallbackFunction.get();

            return CompletableFuture.completedFuture(null);
        }

        // ... and plain Exceptions for parse failures (no subclasses)
        catch (Exception e) {
            logger.warn("\"{}\" is not valid Keeper notation. Please check "
                    + "the documentation at {} for valid formatting.",
                    notation, KEEPER_NOTATION_DOC_URL);
            logger.debug("Provided Keeper notation could not be parsed.", e);
            return CompletableFuture.completedFuture(null);
        }
        finally {
            cacheLock.readLock().unlock();
        }

    }

}
