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

package org.apache.guacamole.protocols;

import java.util.ArrayList;
import java.util.Collection;
import org.apache.guacamole.form.Form;

/**
 * Describes a protocol and all parameters associated with it, as required by
 * a protocol plugin for guacd. Each parameter is described with a Form, which
 * allows the parameters of a protocol to be exposed to the user as friendly
 * groupings of fields.
 */
public class ProtocolInfo {

    /**
     * The unique name associated with this protocol.
     */
    private String name;

    /**
     * A collection of forms describing all known parameters for a connection
     * using this protocol.
     */
    private Collection<Form> connectionForms;

    /**
     * A collection of forms describing all known parameters relevant to a
     * sharing profile whose primary connection uses this protocol.
     */
    private Collection<Form> sharingProfileForms;

    /**
     * Creates a new ProtocolInfo having the given name and forms. The given
     * collections of forms are used to describe the parameters for connections
     * and sharing profiles respectively.
     *
     * @param name
     *     The unique name associated with the protocol.
     *
     * @param connectionForms
     *     A collection of forms describing all known parameters for a
     *     connection using this protocol.
     *
     * @param sharingProfileForms
     *     A collection of forms describing all known parameters relevant to a
     *     sharing profile whose primary connection uses this protocol.
     */
    public ProtocolInfo(String name, Collection<Form> connectionForms,
            Collection<Form> sharingProfileForms) {
        this.name = name;
        this.connectionForms = connectionForms;
        this.sharingProfileForms = sharingProfileForms;
    }

    /**
     * Creates a new ProtocolInfo with no associated name or forms.
     */
    public ProtocolInfo() {
        this(null);
    }

    /**
     * Creates a new ProtocolInfo having the given name, but without any forms.
     *
     * @param name
     *     The unique name associated with the protocol.
     */
    public ProtocolInfo(String name) {
        this(name, new ArrayList<Form>());
    }

    /**
     * Creates a new ProtocolInfo having the given name and forms. The given
     * forms are used to describe the parameters for both connections and
     * sharing profiles.
     *
     * @param name
     *     The unique name associated with the protocol.
     *
     * @param forms
     *     A collection of forms describing all known parameters for this
     *     protocol, regardless of whether it is used in the context of a
     *     connection or a sharing profile.
     */
    public ProtocolInfo(String name, Collection<Form> forms) {
        this(name, forms, new ArrayList<Form>(forms));
    }

    /**
     * Returns the unique name of this protocol. The protocol name is the
     * value required by the corresponding protocol plugin for guacd.
     *
     * @return The unique name of this protocol.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the unique name of this protocol. The protocol name is the value
     * required by the corresponding protocol plugin for guacd.
     *
     * @param name The unique name of this protocol.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns a mutable collection of forms describing all known parameters for
     * a connection using this protocol. Changes to this collection affect the
     * forms exposed to the user.
     *
     * @return
     *     A mutable collection of forms describing all known parameters for a
     *     connection using this protocol.
     */
    public Collection<Form> getConnectionForms() {
        return connectionForms;
    }

    /**
     * Sets the collection of forms describing all known parameters for a
     * connection using this protocol. The provided collection must be mutable.
     *
     * @param connectionForms
     *     A mutable collection of forms describing all known parameters for a
     *     connection using this protocol.
     */
    public void setConnectionForms(Collection<Form> connectionForms) {
        this.connectionForms = connectionForms;
    }

    /**
     * Returns a mutable collection of forms describing all known parameters
     * relevant to a sharing profile whose primary connection uses this
     * protocol. Changes to this collection affect the forms exposed to the
     * user.
     *
     * @return
     *     A mutable collection of forms describing all known parameters
     *     relevant to a sharing profile whose primary connection uses this
     *     protocol.
     */
    public Collection<Form> getSharingProfileForms() {
        return sharingProfileForms;
    }

    /**
     * Sets the collection of forms describing all known parameters relevant to
     * a sharing profile whose primary connection uses this protocol. The
     * provided collection must be mutable.
     *
     * @param sharingProfileForms
     *     A mutable collection of forms describing all known parameters
     *     relevant to a sharing profile whose primary connection uses this
     *     protocol.
     */
    public void setSharingProfileForms(Collection<Form> sharingProfileForms) {
        this.sharingProfileForms = sharingProfileForms;
    }

}
