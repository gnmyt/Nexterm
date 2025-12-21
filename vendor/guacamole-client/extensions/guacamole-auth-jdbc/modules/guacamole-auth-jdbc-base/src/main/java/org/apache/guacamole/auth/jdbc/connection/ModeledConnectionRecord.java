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

package org.apache.guacamole.auth.jdbc.connection;


import org.apache.guacamole.auth.jdbc.base.ModeledActivityRecord;
import org.apache.guacamole.net.auth.ConnectionRecord;

/**
 * A ConnectionRecord which is backed by a database model.
 */
public class ModeledConnectionRecord extends ModeledActivityRecord
        implements ConnectionRecord {

    /**
     * The model object backing this connection record.
     */
    private final ConnectionRecordModel model;

    /**
     * Creates a new ModeledConnectionRecord backed by the given model object.
     * Changes to this record will affect the backing model object, and changes
     * to the backing model object will affect this record.
     * 
     * @param model
     *     The model object to use to back this connection record.
     */
    public ModeledConnectionRecord(ConnectionRecordModel model) {
        super(ConnectionRecordSet.UUID_NAMESPACE, model);
        this.model = model;
    }

    @Override
    public String getConnectionIdentifier() {
        return model.getConnectionIdentifier();
    }

    @Override
    public String getConnectionName() {
        return model.getConnectionName();
    }

    @Override
    public String getSharingProfileIdentifier() {
        return model.getSharingProfileIdentifier();
    }

    @Override
    public String getSharingProfileName() {
        return model.getSharingProfileName();
    }

    @Override
    public ConnectionRecordModel getModel() {
        return model;
    }
    
}
