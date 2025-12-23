--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements.  See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership.  The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License.  You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied.  See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

--
-- User and connection IDs within history table can now be null
--

ALTER TABLE guacamole_connection_history
    ALTER COLUMN user_id SET DEFAULT NULL,
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE guacamole_connection_history
    ALTER COLUMN connection_id SET DEFAULT NULL,
    ALTER COLUMN connection_id DROP NOT NULL;

--
-- Add new username and connection_name columns to history table
--

ALTER TABLE guacamole_connection_history
    ADD COLUMN username varchar(128);

ALTER TABLE guacamole_connection_history
    ADD COLUMN connection_name varchar(128);

--
-- Populate new name columns by joining corresponding tables
--

UPDATE guacamole_connection_history
    SET username = guacamole_user.username
    FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_connection_history.user_id;

UPDATE guacamole_connection_history
    SET connection_name = guacamole_connection.connection_name
    FROM guacamole_connection
    WHERE guacamole_connection.connection_id =
        guacamole_connection_history.connection_id;

--
-- Set NOT NULL now that the column is fully populated
--

ALTER TABLE guacamole_connection_history
    ALTER COLUMN username SET NOT NULL;

ALTER TABLE guacamole_connection_history
    ALTER COLUMN connection_name SET NOT NULL;

--
-- Remove old foreign key constraints with ON DELETE CASCADE
--

ALTER TABLE guacamole_connection_history
    DROP CONSTRAINT guacamole_connection_history_ibfk_1;

ALTER TABLE guacamole_connection_history
    DROP CONSTRAINT guacamole_connection_history_ibfk_2;

--
-- Recreate foreign key constraints with ON DELETE SET NULL
--

ALTER TABLE guacamole_connection_history
    ADD CONSTRAINT guacamole_connection_history_ibfk_1
    FOREIGN KEY (user_id)
    REFERENCES guacamole_user (user_id) ON DELETE SET NULL;

ALTER TABLE guacamole_connection_history
    ADD CONSTRAINT guacamole_connection_history_ibfk_2
    FOREIGN KEY (connection_id)
    REFERENCES guacamole_connection (connection_id) ON DELETE SET NULL;

--
-- Add session affinity column
--

ALTER TABLE guacamole_connection_group
    ADD COLUMN enable_session_affinity boolean NOT NULL DEFAULT FALSE;

--
-- Add new system-level permission
--

ALTER TYPE guacamole_system_permission_type
    ADD VALUE 'CREATE_SHARING_PROFILE'
    AFTER 'CREATE_CONNECTION_GROUP';

--
-- Add sharing profile table
--

CREATE TABLE guacamole_sharing_profile (

  sharing_profile_id    serial       NOT NULL,
  sharing_profile_name  varchar(128) NOT NULL,
  primary_connection_id integer      NOT NULL,

  PRIMARY KEY (sharing_profile_id),

  CONSTRAINT sharing_profile_name_primary
    UNIQUE (sharing_profile_name, primary_connection_id),

  CONSTRAINT guacamole_sharing_profile_ibfk_1
    FOREIGN KEY (primary_connection_id)
    REFERENCES guacamole_connection (connection_id)
    ON DELETE CASCADE

);

CREATE INDEX guacamole_sharing_profile_primary_connection_id
    ON guacamole_sharing_profile(primary_connection_id);

--
-- Add table of sharing profile parameters
--

CREATE TABLE guacamole_sharing_profile_parameter (

  sharing_profile_id integer       NOT NULL,
  parameter_name     varchar(128)  NOT NULL,
  parameter_value    varchar(4096) NOT NULL,

  PRIMARY KEY (sharing_profile_id, parameter_name),

  CONSTRAINT guacamole_sharing_profile_parameter_ibfk_1
    FOREIGN KEY (sharing_profile_id)
    REFERENCES guacamole_sharing_profile (sharing_profile_id) ON DELETE CASCADE

);

CREATE INDEX guacamole_sharing_profile_parameter_sharing_profile_id
    ON guacamole_sharing_profile_parameter(sharing_profile_id);

--
-- Object-level permission table for sharing profiles
--

CREATE TABLE guacamole_sharing_profile_permission (

  user_id            integer NOT NULL,
  sharing_profile_id integer NOT NULL,
  permission         guacamole_object_permission_type NOT NULL,

  PRIMARY KEY (user_id,sharing_profile_id,permission),

  CONSTRAINT guacamole_sharing_profile_permission_ibfk_1
    FOREIGN KEY (sharing_profile_id)
    REFERENCES guacamole_sharing_profile (sharing_profile_id) ON DELETE CASCADE,

  CONSTRAINT guacamole_sharing_profile_permission_ibfk_2
    FOREIGN KEY (user_id)
    REFERENCES guacamole_user (user_id) ON DELETE CASCADE

);

CREATE INDEX guacamole_sharing_profile_permission_sharing_profile_id
    ON guacamole_sharing_profile_permission(sharing_profile_id);

CREATE INDEX guacamole_sharing_profile_permission_user_id
    ON guacamole_sharing_profile_permission(user_id);

--
-- Add new (optional) sharing profile ID and name columns to connection history
--

ALTER TABLE guacamole_connection_history
    ADD COLUMN sharing_profile_id integer;

ALTER TABLE guacamole_connection_history
    ADD COLUMN sharing_profile_name varchar(128);

ALTER TABLE guacamole_connection_history
    ADD CONSTRAINT guacamole_connection_history_ibfk_3
    FOREIGN KEY (sharing_profile_id)
    REFERENCES guacamole_sharing_profile (sharing_profile_id) ON DELETE SET NULL;

CREATE INDEX guacamole_connection_history_sharing_profile_id
    ON guacamole_connection_history(sharing_profile_id);
