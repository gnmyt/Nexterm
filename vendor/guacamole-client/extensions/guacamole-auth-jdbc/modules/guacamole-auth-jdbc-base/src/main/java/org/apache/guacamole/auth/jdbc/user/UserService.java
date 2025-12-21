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

package org.apache.guacamole.auth.jdbc.user;

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectMapper;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectService;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordModel;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSearchTerm;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSortPredicate;
import org.apache.guacamole.auth.jdbc.base.EntityMapper;
import org.apache.guacamole.auth.jdbc.base.ModeledActivityRecord;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionMapper;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionModel;
import org.apache.guacamole.auth.jdbc.permission.UserPermissionMapper;
import org.apache.guacamole.auth.jdbc.security.PasswordEncryptionService;
import org.apache.guacamole.auth.jdbc.security.PasswordPolicyService;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.PasswordField;
import org.apache.guacamole.language.TranslatableGuacamoleClientException;
import org.apache.guacamole.language.TranslatableGuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;
import org.apache.guacamole.properties.CaseSensitivity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating users.
 */
public class UserService extends ModeledDirectoryObjectService<ModeledUser, User, UserModel> {
    
    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    /**
     * All user permissions which are implicitly granted to the new user upon
     * creation.
     */
    private static final ObjectPermission.Type[] IMPLICIT_USER_PERMISSIONS = {
        ObjectPermission.Type.READ
    };

    /**
     * The name of the HTTP password parameter to expect if the user is
     * changing their expired password upon login.
     */
    private static final String NEW_PASSWORD_PARAMETER = "new-password";

    /**
     * The password field to provide the user when their password is expired
     * and must be changed.
     */
    private static final Field NEW_PASSWORD = new PasswordField(NEW_PASSWORD_PARAMETER);

    /**
     * The name of the HTTP password confirmation parameter to expect if the
     * user is changing their expired password upon login.
     */
    private static final String CONFIRM_NEW_PASSWORD_PARAMETER = "confirm-new-password";

    /**
     * The password confirmation field to provide the user when their password
     * is expired and must be changed.
     */
    private static final Field CONFIRM_NEW_PASSWORD = new PasswordField(CONFIRM_NEW_PASSWORD_PARAMETER);

    /**
     * Information describing the expected credentials if a user's password is
     * expired. If a user's password is expired, it must be changed during the
     * login process.
     */
    private static final CredentialsInfo EXPIRED_PASSWORD = new CredentialsInfo(Arrays.asList(
        CredentialsInfo.USERNAME,
        CredentialsInfo.PASSWORD,
        NEW_PASSWORD,
        CONFIRM_NEW_PASSWORD
    ));

    /**
     * Mapper for creating/deleting entities.
     */
    @Inject
    private EntityMapper entityMapper;

    /**
     * Mapper for accessing users.
     */
    @Inject
    private UserMapper userMapper;

    /**
     * Mapper for manipulating user permissions.
     */
    @Inject
    private UserPermissionMapper userPermissionMapper;

    /**
     * Mapper for accessing user login history.
     */
    @Inject
    private UserRecordMapper userRecordMapper;

    /**
     * Provider for creating users.
     */
    @Inject
    private Provider<ModeledUser> userProvider;

    /**
     * Service for hashing passwords.
     */
    @Inject
    private PasswordEncryptionService encryptionService;

    /**
     * Service for enforcing password complexity policies.
     */
    @Inject
    private PasswordPolicyService passwordPolicyService;

    /**
     * The server environment for retrieving configuration.
     */
    @Inject
    private JDBCEnvironment environment;
    
    @Override
    protected ModeledDirectoryObjectMapper<UserModel> getObjectMapper() {
        return userMapper;
    }

    @Override
    protected ObjectPermissionMapper getPermissionMapper() {
        return userPermissionMapper;
    }

    @Override
    protected ModeledUser getObjectInstance(ModeledAuthenticatedUser currentUser,
            UserModel model) throws GuacamoleException {

        boolean exposeRestrictedAttributes;

        // Expose restricted attributes if the user does not yet exist
        if (model.getObjectID() == null)
            exposeRestrictedAttributes = true;

        // Otherwise, if the user permissions are available, expose restricted
        // attributes only if the user has ADMINISTER permission
        else if (currentUser != null)
            exposeRestrictedAttributes = hasObjectPermission(currentUser,
                    model.getIdentifier(), ObjectPermission.Type.ADMINISTER);

        // If user permissions are not available, do not expose anything
        else
            exposeRestrictedAttributes = false;

        // Produce ModeledUser exposing only those attributes for which the
        // current user has permission
        ModeledUser user = userProvider.get();
        user.init(currentUser, model, exposeRestrictedAttributes,
                environment.getCaseSensitivity().caseSensitiveUsernames());
        return user;

    }

    @Override
    protected UserModel getModelInstance(ModeledAuthenticatedUser currentUser,
            final User object) throws GuacamoleException {

        // Create new ModeledUser backed by blank model
        UserModel model = new UserModel();
        ModeledUser user = getObjectInstance(currentUser, model);

        // Set model contents through ModeledUser, copying the provided user
        user.setIdentifier(object.getIdentifier());
        user.setPassword(object.getPassword());
        user.setAttributes(object.getAttributes());

        return model;
        
    }
    
    @Override
    protected CaseSensitivity getCaseSensitivity() throws GuacamoleException {
        return environment.getCaseSensitivity();
    }

    @Override
    protected boolean hasCreatePermission(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return whether user has explicit user creation permission
        SystemPermissionSet permissionSet = user.getUser().getEffectivePermissions().getSystemPermissions();
        return permissionSet.hasPermission(SystemPermission.Type.CREATE_USER);

    }

    @Override
    protected ObjectPermissionSet getEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return permissions related to users
        return user.getUser().getEffectivePermissions().getUserPermissions();

    }

    @Override
    protected void beforeCreate(ModeledAuthenticatedUser user, User object,
            UserModel model) throws GuacamoleException {

        super.beforeCreate(user, object, model);
        
        // Username must not be blank
        if (model.getIdentifier() == null || model.getIdentifier().trim().isEmpty())
            throw new GuacamoleClientException("The username must not be blank.");
        
        // Do not create duplicate users
        Collection<UserModel> existing = userMapper.select(Collections.singleton(
                    model.getIdentifier()), getCaseSensitivity());
        if (!existing.isEmpty())
            throw new GuacamoleClientException("User \"" + model.getIdentifier() + "\" already exists.");

        // Verify new password does not violate defined policies (if specified)
        if (object.getPassword() != null)
            passwordPolicyService.verifyPassword(object.getIdentifier(), object.getPassword());

        // Create base entity object, implicitly populating underlying entity ID
        entityMapper.insert(model);

    }

    @Override
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            ModeledUser object, UserModel model) throws GuacamoleException {

        super.beforeUpdate(user, object, model);

        // Refuse to update if the user is a skeleton and does not actually
        // exist in the database (this will happen if the user is authenticated
        // via a non-database authentication provider)
        if (object.isSkeleton()) {
            logger.info("Data cannot be stored for user \"{}\" as they do not "
                    + "have an account within the database. If this is "
                    + "unexpected, consider allowing automatic creation of "
                    + "user accounts.", object.getIdentifier());
            throw new GuacamoleUnsupportedException("User does not exist "
                    + "within the database and cannot be updated.");
        }

        // Username must not be blank
        if (model.getIdentifier() == null || model.getIdentifier().trim().isEmpty())
            throw new GuacamoleClientException("The username must not be blank.");
        
        // Check whether such a user is already present
        UserModel existing = userMapper.selectOne(model.getIdentifier(),
                getCaseSensitivity());
        if (existing != null) {

            // Do not rename to existing user
            if (!existing.getObjectID().equals(model.getObjectID()))
                throw new GuacamoleClientException("User \"" + model.getIdentifier() + "\" already exists.");
            
        }

        // Verify new password does not violate defined policies (if specified)
        if (object.getPassword() != null) {

            // Enforce password age only for non-privileged users
            if (!user.isPrivileged())
                passwordPolicyService.verifyPasswordAge(object);

            // Always verify password complexity
            passwordPolicyService.verifyPassword(object.getIdentifier(), object.getPassword());

            // Store previous password in history
            passwordPolicyService.recordPassword(object);

        }

    }

    @Override
    protected Collection<ObjectPermissionModel>
        getImplicitPermissions(ModeledAuthenticatedUser user, UserModel model) {
            
        // Get original set of implicit permissions and make a copy
        Collection<ObjectPermissionModel> implicitPermissions =
                new ArrayList<>(super.getImplicitPermissions(user, model));
        
        // Grant implicit permissions to the new user
        for (ObjectPermission.Type permissionType : IMPLICIT_USER_PERMISSIONS) {
            
            ObjectPermissionModel permissionModel = new ObjectPermissionModel();
            permissionModel.setEntityID(model.getEntityID());
            permissionModel.setType(permissionType);
            permissionModel.setObjectIdentifier(model.getIdentifier());

            // Add new permission to implicit permission set 
            implicitPermissions.add(permissionModel);
            
        }
        
        return Collections.unmodifiableCollection(implicitPermissions);
    }
        
    @Override
    protected void beforeDelete(ModeledAuthenticatedUser user, String identifier) throws GuacamoleException {

        super.beforeDelete(user, identifier);

        // Do not allow users to delete themselves
        if (identifier.equals(user.getUser().getIdentifier()))
            throw new GuacamoleUnsupportedException("Deleting your own user is not allowed.");

    }
    
    @Override
    public void deleteObject(ModeledAuthenticatedUser user, String identifier)
        throws GuacamoleException {

        beforeDelete(user, identifier);
        
        // Delete object
        userMapper.delete(identifier, getCaseSensitivity());

    }

    @Override
    protected boolean isValidIdentifier(String identifier) {

        // All strings are valid user identifiers
        return true;

    }

    /**
     * Retrieves the user corresponding to the given credentials from the
     * database. Note that this function will not enforce any additional
     * account restrictions, including explicitly disabled accounts,
     * scheduling, and password expiration. It is the responsibility of the
     * caller to enforce such restrictions, if desired.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the user is being
     *     retrieved.
     *
     * @param credentials
     *     The credentials to use when locating the user.
     *
     * @return
     *     An AuthenticatedUser containing the existing ModeledUser object if
     *     the credentials given are valid, null otherwise.
     *
     * @throws GuacamoleException
     *     If the provided credentials to not conform to expectations.
     */
    public ModeledAuthenticatedUser retrieveAuthenticatedUser(AuthenticationProvider authenticationProvider,
            Credentials credentials) throws GuacamoleException {

        // Get username and password
        String username = credentials.getUsername();
        String password = credentials.getPassword();

        // Retrieve corresponding user model, if such a user exists
        UserModel userModel = userMapper.selectOne(username,
                getCaseSensitivity());
        if (userModel == null)
            return null;

        // Verify provided password is correct
        byte[] hash = encryptionService.createPasswordHash(password, userModel.getPasswordSalt());
        if (!Arrays.equals(hash, userModel.getPasswordHash()))
            return null;

        // Create corresponding user object, set up cyclic reference
        ModeledUser user = getObjectInstance(null, userModel);
        user.setCurrentUser(new ModeledAuthenticatedUser(authenticationProvider, user, credentials));

        // Return now-authenticated user
        return user.getCurrentUser();

    }

    /**
     * Retrieves the user corresponding to the given AuthenticatedUser from the
     * database.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the user is being
     *     retrieved.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to retrieve the corresponding ModeledUser of.
     *
     * @return
     *     The ModeledUser which corresponds to the given AuthenticatedUser, or
     *     null if no such user exists.
     *
     * @throws GuacamoleException
     *     If a ModeledUser object for the user corresponding to the given
     *     AuthenticatedUser cannot be created.
     */
    public ModeledUser retrieveUser(AuthenticationProvider authenticationProvider,
            AuthenticatedUser authenticatedUser) throws GuacamoleException {

        // Retrieve corresponding user model, if such a user exists
        UserModel userModel = userMapper.selectOne(authenticatedUser.getIdentifier(),
                getCaseSensitivity());
        if (userModel == null)
            return null;

        // Create corresponding user object, set up cyclic reference
        ModeledUser user = getObjectInstance(null, userModel);
        user.setCurrentUser(new ModeledAuthenticatedUser(authenticatedUser,
                authenticationProvider, user));

        // Return already-authenticated user
        return user;

    }
    
    /**
     * Generates an empty (skeleton) user corresponding to the given
     * AuthenticatedUser.  The user will not be stored in the database, and
     * will only be available in-memory during the time the session is
     * active.
     * 
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the user is being
     *     retrieved.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to generate the skeleton account for.
     *
     * @return
     *     The empty ModeledUser which corresponds to the given
     *     AuthenticatedUser.
     *
     * @throws GuacamoleException
     *     If a ModeledUser object for the user corresponding to the given
     *     AuthenticatedUser cannot be created.
     */
    public ModeledUser retrieveSkeletonUser(AuthenticationProvider authenticationProvider,
            AuthenticatedUser authenticatedUser) throws GuacamoleException {
        
        // Set up an empty user model
        ModeledUser user = getObjectInstance(null,
                new UserModel(authenticatedUser.getIdentifier()));
        
        // Create user object, and configure cyclic reference
        user.setCurrentUser(new ModeledAuthenticatedUser(authenticatedUser,
                authenticationProvider, user));
        
        // Return the new user.
        return user;
        
    }

    /**
     * Resets the password of the given user to the new password specified via
     * the "new-password" and "confirm-new-password" parameters from the
     * provided credentials. If these parameters are missing or invalid,
     * additional credentials will be requested.
     *
     * @param user
     *     The user whose password should be reset.
     *
     * @param credentials
     *     The credentials from which the parameters required for password
     *     reset should be retrieved.
     *
     * @throws GuacamoleException
     *     If the password reset parameters within the given credentials are
     *     invalid or missing.
     */
    public void resetExpiredPassword(ModeledUser user, Credentials credentials)
            throws GuacamoleException {

        UserModel userModel = user.getModel();

        // Get username
        String username = user.getIdentifier();

        // Pull new password from HTTP request
        String newPassword = credentials.getParameter(NEW_PASSWORD_PARAMETER);
        String confirmNewPassword = credentials.getParameter(CONFIRM_NEW_PASSWORD_PARAMETER);

        // Require new password if account is expired
        if (newPassword == null || confirmNewPassword == null) {
            logger.info("The password of user \"{}\" has expired and must be reset.", username);
            throw new TranslatableGuacamoleInsufficientCredentialsException("Password has expired",
                    "LOGIN.INFO_PASSWORD_EXPIRED", EXPIRED_PASSWORD);
        }

        // New password must be different from old password
        if (newPassword.equals(credentials.getPassword()))
            throw new TranslatableGuacamoleClientException("New passwords may "
                    + "not be identical to the current password if password "
                    + "reset is required.", "LOGIN.ERROR_PASSWORD_SAME");

        // New password must not be blank
        if (newPassword.isEmpty())
            throw new TranslatableGuacamoleClientException("Passwords may not "
                    + "be blank.", "LOGIN.ERROR_PASSWORD_BLANK");

        // Confirm that the password was entered correctly twice
        if (!newPassword.equals(confirmNewPassword))
            throw new TranslatableGuacamoleClientException("New password does "
                    + "not match.", "LOGIN.ERROR_PASSWORD_MISMATCH");

        // Verify new password does not violate defined policies
        passwordPolicyService.verifyPassword(username, newPassword);

        // Change password and reset expiration flag
        userModel.setExpired(false);
        user.setPassword(newPassword);
        userMapper.update(userModel);
        logger.info("Expired password of user \"{}\" has been reset.", username);

    }

    /**
     * Returns a ActivityRecord object which is backed by the given model.
     *
     * @param model
     *     The model object to use to back the returned connection record
     *     object.
     *
     * @return
     *     A connection record object which is backed by the given model.
     */
    protected ActivityRecord getObjectInstance(ActivityRecordModel model) {
        return new ModeledActivityRecord(UserRecordSet.UUID_NAMESPACE, model);
    }

    /**
     * Returns a list of ActivityRecord objects which are backed by the
     * models in the given list.
     *
     * @param models
     *     The model objects to use to back the activity record objects
     *     within the returned list.
     *
     * @return
     *     A list of activity record objects which are backed by the models
     *     in the given list.
     */
    protected List<ActivityRecord> getObjectInstances(List<ActivityRecordModel> models) {

        // Create new list of records by manually converting each model
        List<ActivityRecord> objects = new ArrayList<ActivityRecord>(models.size());
        for (ActivityRecordModel model : models)
            objects.add(getObjectInstance(model));

        return objects;

    }

    /**
     * Retrieves user login history records matching the given criteria.
     * Retrieves up to <code>limit</code> user history records matching the
     * given terms and sorted by the given predicates. Only history records
     * associated with data that the given user can read are returned.
     *
     * @param username
     *     The optional username to which history records should be limited, or
     *     null if all readable records should be retrieved.
     * 
     * @param user
     *     The user retrieving the login history.
     *
     * @param recordIdentifier
     *     The identifier of the specific history record to retrieve, if not
     *     all matching records. Search terms, etc. will still be applied to
     *     the single record.
     *
     * @param requiredContents
     *     The search terms that must be contained somewhere within each of the
     *     returned records.
     *
     * @param sortPredicates
     *     A list of predicates to sort the returned records by, in order of
     *     priority.
     *
     * @param limit
     *     The maximum number of records that should be returned.
     *
     * @return
     *     The login history of the given user, including any active sessions.
     *
     * @throws GuacamoleException
     *     If permission to read the user login history is denied.
     */
    public List<ActivityRecord> retrieveHistory(String username,
            ModeledAuthenticatedUser user, String recordIdentifier,
            Collection<ActivityRecordSearchTerm> requiredContents,
            List<ActivityRecordSortPredicate> sortPredicates, int limit)
            throws GuacamoleException {

        List<ActivityRecordModel> searchResults;

        // Bypass permission checks if the user is privileged or has System-level audit permissions
        if (user.isPrivileged() || user.getUser().getEffectivePermissions().getSystemPermissions().hasPermission(SystemPermission.Type.AUDIT))
            searchResults = userRecordMapper.search(username, recordIdentifier,
                    requiredContents, sortPredicates, limit,
                    getCaseSensitivity());

        // Otherwise only return explicitly readable history records
        else
            searchResults = userRecordMapper.searchReadable(username, 
                    user.getUser().getModel(), recordIdentifier,
                    requiredContents, sortPredicates, limit,
                    user.getEffectiveUserGroups(),
                    getCaseSensitivity());

        return getObjectInstances(searchResults);

    }

}
