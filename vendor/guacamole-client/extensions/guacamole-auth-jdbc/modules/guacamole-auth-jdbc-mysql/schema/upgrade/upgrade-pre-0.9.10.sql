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
    MODIFY COLUMN user_id INT(11) DEFAULT NULL;

ALTER TABLE guacamole_connection_history
    MODIFY COLUMN connection_id INT(11) DEFAULT NULL;

--
-- Add new username and connection_name columns to history table
--

ALTER TABLE guacamole_connection_history
    ADD COLUMN username VARCHAR(128);

ALTER TABLE guacamole_connection_history
    ADD COLUMN connection_name VARCHAR(128);

--
-- Populate new name columns by joining corresponding tables
--

UPDATE guacamole_connection_history
JOIN guacamole_user
    ON guacamole_user.user_id = guacamole_connection_history.user_id
SET guacamole_connection_history.username = guacamole_user.username;

UPDATE guacamole_connection_history
JOIN guacamole_connection
    ON guacamole_connection.connection_id =
        guacamole_connection_history.connection_id
SET guacamole_connection_history.connection_name =
    guacamole_connection.connection_name;

--
-- Set NOT NULL now that the column is fully populated
--

ALTER TABLE guacamole_connection_history
    MODIFY username VARCHAR(128) NOT NULL;

ALTER TABLE guacamole_connection_history
    MODIFY connection_name VARCHAR(128) NOT NULL;

--
-- Remove old foreign key constraints with ON DELETE CASCADE
--

ALTER TABLE guacamole_connection_history
    DROP FOREIGN KEY guacamole_connection_history_ibfk_1;

ALTER TABLE guacamole_connection_history
    DROP FOREIGN KEY guacamole_connection_history_ibfk_2;

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
    ADD COLUMN enable_session_affinity boolean NOT NULL DEFAULT 0;

--
-- Add new system-level permission
--

ALTER TABLE `guacamole_system_permission`
    MODIFY `permission` enum('CREATE_CONNECTION',
                             'CREATE_CONNECTION_GROUP',
                             'CREATE_SHARING_PROFILE',
                             'CREATE_USER',
                             'ADMINISTER') NOT NULL;

--
-- Add sharing profile table
--

CREATE TABLE guacamole_sharing_profile (

  `sharing_profile_id`    int(11)      NOT NULL AUTO_INCREMENT,
  `sharing_profile_name`  varchar(128) NOT NULL,
  `primary_connection_id` int(11)      NOT NULL,

  PRIMARY KEY (`sharing_profile_id`),
  UNIQUE KEY `sharing_profile_name_primary` (sharing_profile_name, primary_connection_id),

  CONSTRAINT `guacamole_sharing_profile_ibfk_1`
    FOREIGN KEY (`primary_connection_id`)
    REFERENCES `guacamole_connection` (`connection_id`)
    ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Add table of sharing profile parameters
--

CREATE TABLE guacamole_sharing_profile_parameter (

  `sharing_profile_id` integer       NOT NULL,
  `parameter_name`     varchar(128)  NOT NULL,
  `parameter_value`    varchar(4096) NOT NULL,

  PRIMARY KEY (`sharing_profile_id`, `parameter_name`),

  CONSTRAINT `guacamole_sharing_profile_parameter_ibfk_1`
    FOREIGN KEY (`sharing_profile_id`)
    REFERENCES `guacamole_sharing_profile` (`sharing_profile_id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Object-level permission table for sharing profiles
--

CREATE TABLE guacamole_sharing_profile_permission (

  `user_id`            integer NOT NULL,
  `sharing_profile_id` integer NOT NULL,
  `permission`         enum('READ',
                            'UPDATE',
                            'DELETE',
                            'ADMINISTER') NOT NULL,

  PRIMARY KEY (`user_id`, `sharing_profile_id`, `permission`),

  CONSTRAINT `guacamole_sharing_profile_permission_ibfk_1`
    FOREIGN KEY (`sharing_profile_id`)
    REFERENCES `guacamole_sharing_profile` (`sharing_profile_id`) ON DELETE CASCADE,

  CONSTRAINT `guacamole_sharing_profile_permission_ibfk_2`
    FOREIGN KEY (`user_id`)
    REFERENCES `guacamole_user` (`user_id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Add new (optional) sharing profile ID and name columns to connection history
--

ALTER TABLE guacamole_connection_history
    ADD COLUMN sharing_profile_id INT(11);

ALTER TABLE guacamole_connection_history
    ADD COLUMN sharing_profile_name VARCHAR(128);

ALTER TABLE guacamole_connection_history
    ADD CONSTRAINT guacamole_connection_history_ibfk_3
    FOREIGN KEY (sharing_profile_id)
    REFERENCES guacamole_sharing_profile (sharing_profile_id) ON DELETE SET NULL;
