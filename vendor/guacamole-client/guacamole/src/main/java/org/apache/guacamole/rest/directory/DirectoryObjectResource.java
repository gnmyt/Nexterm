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

package org.apache.guacamole.rest.directory;

import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.event.DirectoryEvent;
import org.apache.guacamole.net.event.DirectoryFailureEvent;
import org.apache.guacamole.net.event.DirectorySuccessEvent;
import org.apache.guacamole.rest.event.ListenerService;

/**
 * A REST resource which abstracts the operations available on an existing
 * Guacamole object that is contained within a Directory, such as modification,
 * deletion, or individual retrieval.
 *
 * @param <InternalType>
 *     The type of object that this DirectoryObjectResource represents. To
 *     avoid coupling the REST API too tightly to the extension API, these
 *     objects are not directly serialized or deserialized when handling REST
 *     requests.
 *
 * @param <ExternalType>
 *     The type of object used in interchange (ie: serialized/deserialized as
 *     JSON) between REST clients and this DirectoryObjectResource to
 *     represent the InternalType.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public abstract class DirectoryObjectResource<InternalType extends Identifiable, ExternalType> {

    /**
     * The user that is accessing this resource.
     */
    private final AuthenticatedUser authenticatedUser;
    
    /**
     * The UserContext associated with the Directory containing the object
     * represented by this DirectoryObjectResource.
     */
    private final UserContext userContext;

    /**
     * The type of object represented by this DirectoryObjectResource.
     */
    private final Class<InternalType> internalType;
    
    /**
     * The Directory which contains the object represented by this
     * DirectoryObjectResource.
     */
    private final Directory<InternalType> directory;

    /**
     * The object represented by this DirectoryObjectResource.
     */
    private final InternalType object;

    /**
     * A DirectoryObjectTranslator implementation which handles the type of
     * objects represented by this DirectoryObjectResource.
     */
    private final DirectoryObjectTranslator<InternalType, ExternalType> translator;

    /**
     * Service for dispatching events to registered listeners.
     */
    @Inject
    private ListenerService listenerService;

    /**
     * Creates a new DirectoryObjectResource which exposes the operations
     * available for the given object.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param internalType
     *     The type of object that this DirectoryObjectResource should
     *     represent.
     * 
     * @param directory
     *     The Directory which contains the given object.
     *
     * @param object
     *     The object that this DirectoryObjectResource should represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles the type of
     *     object given.
     */
    public DirectoryObjectResource(AuthenticatedUser authenticatedUser,
            UserContext userContext, Class<InternalType> internalType,
            Directory<InternalType> directory, InternalType object,
            DirectoryObjectTranslator<InternalType, ExternalType> translator) {
        this.authenticatedUser = authenticatedUser;
        this.userContext = userContext;
        this.directory = directory;
        this.internalType = internalType;
        this.object = object;
        this.translator = translator;
    }

    /**
     * Notifies all registered listeners that the given operation has succeeded
     * against the object represented by this resource.
     * 
     * @param operation
     *     The operation that was performed.
     *
     * @throws GuacamoleException
     *     If a listener throws a GuacamoleException from its event handler.
     */
    protected void fireDirectorySuccessEvent(DirectoryEvent.Operation operation)
            throws GuacamoleException {
        listenerService.handleEvent(new DirectorySuccessEvent<InternalType>() {

            @Override
            public Directory.Type getDirectoryType() {
                return Directory.Type.of(internalType);
            }

            @Override
            public DirectoryEvent.Operation getOperation() {
                return operation;
            }

            @Override
            public String getObjectIdentifier() {
                return object.getIdentifier();
            }

            @Override
            public InternalType getObject() {
                return object;
            }

            @Override
            public AuthenticatedUser getAuthenticatedUser() {
                return authenticatedUser;
            }

            @Override
            public AuthenticationProvider getAuthenticationProvider() {
                return userContext.getAuthenticationProvider();
            }

        });
    }

    /**
     * Notifies all registered listeners that the given operation has failed
     * against the object represented by this resource.
     *
     * @param operation
     *     The operation that failed.
     *
     * @param failure
     *     The failure that occurred.
     *
     * @throws GuacamoleException
     *     If a listener throws a GuacamoleException from its event handler.
     */
    protected void fireDirectoryFailureEvent(DirectoryEvent.Operation operation,
            Throwable failure) throws GuacamoleException {
        listenerService.handleEvent(new DirectoryFailureEvent<InternalType>() {

            @Override
            public Directory.Type getDirectoryType() {
                return Directory.Type.of(internalType);
            }

            @Override
            public DirectoryEvent.Operation getOperation() {
                return operation;
            }

            @Override
            public String getObjectIdentifier() {
                return object.getIdentifier();
            }

            @Override
            public InternalType getObject() {
                return object;
            }

            @Override
            public AuthenticatedUser getAuthenticatedUser() {
                return authenticatedUser;
            }

            @Override
            public AuthenticationProvider getAuthenticationProvider() {
                return userContext.getAuthenticationProvider();
            }

            @Override
            public Throwable getFailure() {
                return failure;
            }

        });
    }

    /**
     * Returns the user accessing this resource.
     *
     * @return
     *     The user accessing this resource.
     */
    protected AuthenticatedUser getAuthenticatedUser() {
        return authenticatedUser;
    }

    /**
     * Returns the UserContext providing the Directory that contains the object
     * exposed by this resource.
     *
     * @return 
     *     The UserContext providing the Directory that contains the object
     *     exposed by this resource.
     */
    protected UserContext getUserContext() {
        return userContext;
    }

    /**
     * Returns the Directory containing the object exposed by this resource.
     *
     * @return 
     *     The Directory containing the object exposed by this resource.
     */
    protected Directory<InternalType> getDirectory() {
        return directory;
    }

    /**
     * Returns the object exposed by this resource.
     *
     * @return
     *     The object exposed by this resource.
     */
    protected InternalType getInternalObject() {
        return object;
    }

    /**
     * Returns the object represented by this DirectoryObjectResource, in a
     * format intended for interchange.
     *
     * @return
     *     The object that this DirectoryObjectResource represents, in a format
     *     intended for interchange.
     *
     * @throws GuacamoleException
     *     If an error is encountered while retrieving the object.
     */
    @GET
    public ExternalType getObject() throws GuacamoleException {
        return translator.toExternalObject(object);
    }

    /**
     * Updates an existing object. The changes to be made to the corresponding
     * object within the directory indicated by the provided data.
     *
     * @param modifiedObject
     *     The data to update the corresponding object with.
     *
     * @throws GuacamoleException
     *     If an error occurs while updating the object.
     */
    @PUT
    public void updateObject(ExternalType modifiedObject) throws GuacamoleException {

        // Validate that data was provided
        if (modifiedObject == null)
            throw new GuacamoleClientException("Data must be submitted when updating objects.");

        // Filter/sanitize object contents
        translator.filterExternalObject(userContext, modifiedObject);

        // Perform update
        translator.applyExternalChanges(object, modifiedObject);

        try {
            directory.update(object);
            fireDirectorySuccessEvent(DirectoryEvent.Operation.UPDATE);
        }
        catch (GuacamoleException | RuntimeException | Error e) {
            fireDirectoryFailureEvent(DirectoryEvent.Operation.UPDATE, e);
            throw e;
        }

    }

    /**
     * Removes this object from the containing directory.
     *
     * @throws GuacamoleException
     *     If an error occurs while removing the object.
     */
    @DELETE
    public void deleteObject() throws GuacamoleException {
        try {
            directory.remove(object.getIdentifier());
            fireDirectorySuccessEvent(DirectoryEvent.Operation.REMOVE);
        }
        catch (GuacamoleException | RuntimeException | Error e) {
            fireDirectoryFailureEvent(DirectoryEvent.Operation.REMOVE, e);
            throw e;
        }
    }

}
