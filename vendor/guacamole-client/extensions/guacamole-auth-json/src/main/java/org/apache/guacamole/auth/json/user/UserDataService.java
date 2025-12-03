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

package org.apache.guacamole.auth.json.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.BaseEncoding;
import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.json.ConfigurationService;
import org.apache.guacamole.auth.json.CryptoService;
import org.apache.guacamole.auth.json.RequestValidationService;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.simple.SimpleDirectory;
import org.apache.guacamole.net.auth.simple.SimpleObjectPermissionSet;
import org.apache.guacamole.net.auth.simple.SimpleUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for deriving Guacamole extension API data from UserData objects.
 */
@Singleton
public class UserDataService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserDataService.class);

    /**
     * ObjectMapper for deserializing UserData objects.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * Denylist of single-use user data objects which have already been used.
     */
    private final UserDataDenylist denylist = new UserDataDenylist();

    /**
     * Service for retrieving configuration information regarding the
     * JSONAuthenticationProvider.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Service for testing the validity of HTTP requests.
     */
    @Inject
    private RequestValidationService requestService;

    /**
     * Service for handling cryptography-related operations.
     */
    @Inject
    private CryptoService cryptoService;

    /**
     * Provider for UserDataConnection instances.
     */
    @Inject
    private Provider<UserDataConnection> userDataConnectionProvider;

    /**
     * The name of the HTTP parameter from which base64-encoded, encrypted JSON
     * data should be read. The value of this parameter, when decoded and
     * decrypted, must be valid JSON prepended with the 32-byte raw binary
     * signature generated through signing the JSON with the secret key using
     * HMAC/SHA-256.
     */
    public static final String ENCRYPTED_DATA_PARAMETER = "data";

    /**
     * Derives a new UserData object from the data contained within the given
     * Credentials. If no such data is present, or the data present is invalid,
     * null is returned.
     *
     * @param credentials
     *     The Credentials from which the new UserData object should be
     *     derived.
     *
     * @return
     *     A new UserData object derived from the data contained within the
     *     given Credentials, or null if no such data is present or if the data
     *     present is invalid.
     */
    public UserData fromCredentials(Credentials credentials) {

        String json;
        byte[] correctSignature;

        // Abort if the request itself is not allowed
        if (!requestService.isAuthenticationAllowed(credentials))
            return null;

        // Pull base64-encoded, encrypted JSON data from HTTP request, if any
        // such data is present
        String base64 = credentials.getParameter(ENCRYPTED_DATA_PARAMETER);
        if (base64 == null)
            return null;

        // Decrypt base64-encoded parameter
        try {

            // Decrypt using defined encryption key
            byte[] decrypted = cryptoService.decrypt(
                cryptoService.createEncryptionKey(confService.getSecretKey()),
                BaseEncoding.base64().decode(base64)
            );

            // Abort if decrypted value cannot possibly have a signature AND data
            if (decrypted.length <= CryptoService.SIGNATURE_LENGTH) {
                logger.warn("Submitted data is too small to contain both a signature and JSON.");
                return null;
            }

            // Split data into signature and JSON portions
            byte[] receivedSignature = Arrays.copyOf(decrypted, CryptoService.SIGNATURE_LENGTH);
            byte[] receivedJSON = Arrays.copyOfRange(decrypted, CryptoService.SIGNATURE_LENGTH, decrypted.length);

            // Produce signature for decrypted data
            correctSignature = cryptoService.sign(
                cryptoService.createSignatureKey(confService.getSecretKey()),
                receivedJSON
            );

            // Verify signatures
            if (!Arrays.equals(receivedSignature, correctSignature)) {
                logger.warn("Signature of submitted data is incorrect.");
                return null;
            }

            // Convert from UTF-8
            json = new String(receivedJSON, "UTF-8");

        }

        // Fail if base64 data is not valid
        catch (IllegalArgumentException e) {
            logger.warn("Submitted data is not proper base64.");
            logger.debug("Invalid base64 data.", e);
            return null;
        }

        // Handle lack of standard UTF-8 support (should never happen)
        catch (UnsupportedEncodingException e) {
            logger.error("Unexpected lack of support for UTF-8: {}", e.getMessage());
            logger.debug("Unable to decode base64 data as UTF-8.", e);
            return null;
        }

        // Fail if decryption or key retrieval fails for any reason
        catch (GuacamoleException e) {
            logger.error("Decryption of received data failed: {}", e.getMessage());
            logger.debug("Unable to decrypt received data.", e);
            return null;
        }

        // Deserialize UserData from submitted JSON data
        try {

            // Deserialize UserData, but reject if expired
            UserData userData = mapper.readValue(json, UserData.class);
            if (userData.isExpired())
                return null;

            // Reject if data is single-use and already present in the denylist
            if (userData.isSingleUse() && !denylist.add(userData, correctSignature))
                return null;

            return userData;

        }

        // Fail UserData creation if JSON is invalid/unreadable
        catch (IOException e) {
            logger.error("Received JSON is invalid: {}", e.getMessage());
            logger.debug("Error parsing UserData JSON.", e);
            return null;
        }

    }

    /**
     * Returns the identifiers of all users readable by the user whose data is
     * given by the provided UserData object. As users of the
     * JSONAuthenticationProvider can only see themselves, this will always
     * simply be a set of the user's own username.
     *
     * @param userData
     *     All data associated with the user whose accessible user identifiers
     *     are being retrieved.
     *
     * @return
     *     A set containing the identifiers of all users readable by the user
     *     whose data is given by the provided UserData object.
     */
    public Set<String> getUserIdentifiers(UserData userData) {

        // Each user can only see themselves
        return Collections.singleton(userData.getUsername());

    }

    /**
     * Returns the user object of the user to whom the given UserData object
     * belongs.
     *
     * @param userData
     *     All data associated with the user whose own user object is being
     *     retrieved.
     *
     * @return
     *     The user object of the user to whom the given UserData object
     *     belongs.
     */
    public User getUser(UserData userData) {

        // Build user object with READ access to all available data
        return new SimpleUser(userData.getUsername()) {

            @Override
            public ObjectPermissionSet getUserPermissions() throws GuacamoleException {
                return new SimpleObjectPermissionSet(getUserIdentifiers(userData));
            }

            @Override
            public ObjectPermissionSet getConnectionPermissions() throws GuacamoleException {
                return new SimpleObjectPermissionSet(getConnectionIdentifiers(userData));
            }

            @Override
            public ObjectPermissionSet getConnectionGroupPermissions() throws GuacamoleException {
                return new SimpleObjectPermissionSet(getConnectionGroupIdentifiers(userData));
            }

        };

    }

    /**
     * Returns the identifiers of all connections readable by the user whose
     * data is given by the provided UserData object. If the provided UserData
     * is not expired, this will be the set of all connection identifiers
     * within the UserData. If the UserData is expired, this will be an empty
     * set.
     *
     * @param userData
     *     All data associated with the user whose accessible connection
     *     identifiers are being retrieved.
     *
     * @return
     *     A set containing the identifiers of all connections readable by the
     *     user whose data is given by the provided UserData object.
     */
    public Set<String> getConnectionIdentifiers(UserData userData) {

        // Do not return any connections if empty or expired
        Map<String, UserData.Connection> connections = userData.getConnections();
        if (connections == null || userData.isExpired())
            return Collections.<String>emptySet();

        // Return all available connection identifiers
        return connections.keySet();

    }

    /**
     * Returns a Directory containing all connections accessible by the user
     * whose data is given by the provided UserData object. If the given
     * UserData object is not expired, this Directory will contain absolutely
     * all connections defined within the given UserData. If the given UserData
     * object is expired, this Directory will be empty.
     *
     * @param userData
     *     All data associated with the user whose connection directory is
     *     being retrieved.
     *
     * @return
     *     A Directory containing all connections accessible by the user whose
     *     data is given by the provided UserData object.
     */
    public Directory<Connection> getConnectionDirectory(UserData userData) {

        // Do not return any connections if empty or expired
        Map<String, UserData.Connection> connections = userData.getConnections();
        if (connections == null || userData.isExpired())
            return new SimpleDirectory<>();

        // Convert UserData.Connection objects to normal Connections
        Map<String, Connection> directoryContents = new HashMap<>();
        for (Map.Entry<String, UserData.Connection> entry : connections.entrySet()) {

            // Pull connection and associated identifier
            String identifier = entry.getKey();
            UserData.Connection connection = entry.getValue();

            // Create Guacamole connection containing the defined identifier
            // and parameters
            Connection guacConnection = userDataConnectionProvider.get().init(
                userData,
                identifier,
                connection
            );

            // Add corresponding Connection to directory
            directoryContents.put(identifier, guacConnection);

        }

        return new SimpleDirectory<>(directoryContents);

    }

    /**
     * Returns the identifiers of all connection groups readable by the user
     * whose data is given by the provided UserData object. This will always be
     * a set containing only the root connection group identifier. The
     * JSONAuthenticationProvider does not define any other connection groups.
     *
     * @param userData
     *     All data associated with the user whose accessible connection group
     *     identifiers are being retrieved.
     *
     * @return
     *     A set containing the identifiers of all connection groups readable
     *     by the user whose data is given by the provided UserData object.
     */
    public Set<String> getConnectionGroupIdentifiers(UserData userData) {

        // The only connection group available is the root group
        return Collections.singleton(UserContext.ROOT_CONNECTION_GROUP);

    }

}
