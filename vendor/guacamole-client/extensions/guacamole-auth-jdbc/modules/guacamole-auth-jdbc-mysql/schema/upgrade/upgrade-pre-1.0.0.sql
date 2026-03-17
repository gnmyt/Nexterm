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
-- Add new system-level permission
--

ALTER TABLE `guacamole_system_permission`
    MODIFY `permission` enum('CREATE_CONNECTION',
                             'CREATE_CONNECTION_GROUP',
                             'CREATE_SHARING_PROFILE',
                             'CREATE_USER',
                             'CREATE_USER_GROUP',
                             'ADMINISTER') NOT NULL;

--
-- Table of base entities which may each be either a user or user group. Other
-- tables which represent qualities shared by both users and groups will point
-- to guacamole_entity, while tables which represent qualities specific to
-- users or groups will point to guacamole_user or guacamole_user_group.
--

CREATE TABLE `guacamole_entity` (

  `entity_id`     int(11)            NOT NULL AUTO_INCREMENT,
  `name`          varchar(128)       NOT NULL,
  `type`          enum('USER',
                       'USER_GROUP') NOT NULL,

  PRIMARY KEY (`entity_id`),
  UNIQUE KEY `guacamole_entity_name_scope` (`type`, `name`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of user groups. Each user group may have an arbitrary set of member
-- users and member groups, with those members inheriting the permissions
-- granted to that group.
--

CREATE TABLE `guacamole_user_group` (

  `user_group_id` int(11)      NOT NULL AUTO_INCREMENT,
  `entity_id`     int(11)      NOT NULL,

  -- Group disabled status
  `disabled`      boolean      NOT NULL DEFAULT 0,

  PRIMARY KEY (`user_group_id`),

  UNIQUE KEY `guacamole_user_group_single_entity` (`entity_id`),

  CONSTRAINT `guacamole_user_group_entity`
    FOREIGN KEY (`entity_id`)
    REFERENCES `guacamole_entity` (`entity_id`)
    ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of users which are members of given user groups.
--

CREATE TABLE `guacamole_user_group_member` (

  `user_group_id`    int(11)     NOT NULL,
  `member_entity_id` int(11)     NOT NULL,

  PRIMARY KEY (`user_group_id`, `member_entity_id`),

  -- Parent must be a user group
  CONSTRAINT `guacamole_user_group_member_parent_id`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `guacamole_user_group` (`user_group_id`) ON DELETE CASCADE,

  -- Member may be either a user or a user group (any entity)
  CONSTRAINT `guacamole_user_group_member_entity_id`
    FOREIGN KEY (`member_entity_id`)
    REFERENCES `guacamole_entity` (`entity_id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of user group permissions. Each user group permission grants a user
-- or user group access to a another user group (the "affected" user group) for
-- a specific type of operation.
--

CREATE TABLE `guacamole_user_group_permission` (

  `entity_id`              int(11) NOT NULL,
  `affected_user_group_id` int(11) NOT NULL,
  `permission`             enum('READ',
                                'UPDATE',
                                'DELETE',
                                'ADMINISTER') NOT NULL,

  PRIMARY KEY (`entity_id`, `affected_user_group_id`, `permission`),

  CONSTRAINT `guacamole_user_group_permission_affected_user_group`
    FOREIGN KEY (`affected_user_group_id`)
    REFERENCES `guacamole_user_group` (`user_group_id`) ON DELETE CASCADE,

  CONSTRAINT `guacamole_user_group_permission_entity`
    FOREIGN KEY (`entity_id`)
    REFERENCES `guacamole_entity` (`entity_id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Modify guacamole_user table to use guacamole_entity as a base
--

-- Add new entity_id column
ALTER TABLE guacamole_user ADD COLUMN entity_id int(11);

-- Create user entities for each guacamole_user entry
INSERT INTO guacamole_entity (name, type)
SELECT username, 'USER' FROM guacamole_user;

-- Update guacamole_user to point to corresponding guacamole_entity
UPDATE guacamole_user SET entity_id = (
    SELECT entity_id FROM guacamole_entity
    WHERE
            username = guacamole_entity.name
        AND type = 'USER'
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_user MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now be unique for each user
ALTER TABLE guacamole_user
    ADD CONSTRAINT guacamole_user_single_entity
    UNIQUE (entity_id);

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_user
    ADD CONSTRAINT guacamole_user_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- The username column can now safely be removed
ALTER TABLE guacamole_user DROP COLUMN username;

--
-- Modify guacamole_connection_permission to use guacamole_entity instead of
-- guacamole_user
--

-- Add new entity_id column
ALTER TABLE guacamole_connection_permission ADD COLUMN entity_id int(11);

-- Update guacamole_connection_permission to point to the guacamole_entity
-- that has been granted the permission
UPDATE guacamole_connection_permission SET entity_id = (
    SELECT entity_id FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_connection_permission.user_id
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_connection_permission MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_connection_permission
    ADD CONSTRAINT guacamole_connection_permission_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- Remove user_id column
ALTER TABLE guacamole_connection_permission DROP FOREIGN KEY guacamole_connection_permission_ibfk_2;
ALTER TABLE guacamole_connection_permission DROP PRIMARY KEY;
ALTER TABLE guacamole_connection_permission DROP COLUMN user_id;

-- Add new primary key which uses entity_id
ALTER TABLE guacamole_connection_permission
    ADD PRIMARY KEY (entity_id, connection_id, permission);

--
-- Modify guacamole_connection_group_permission to use guacamole_entity instead
-- of guacamole_user
--

-- Add new entity_id column
ALTER TABLE guacamole_connection_group_permission ADD COLUMN entity_id int(11);

-- Update guacamole_connection_group_permission to point to the guacamole_entity
-- that has been granted the permission
UPDATE guacamole_connection_group_permission SET entity_id = (
    SELECT entity_id FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_connection_group_permission.user_id
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_connection_group_permission MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_connection_group_permission
    ADD CONSTRAINT guacamole_connection_group_permission_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- Remove user_id column
ALTER TABLE guacamole_connection_group_permission DROP FOREIGN KEY guacamole_connection_group_permission_ibfk_2;
ALTER TABLE guacamole_connection_group_permission DROP PRIMARY KEY;
ALTER TABLE guacamole_connection_group_permission DROP COLUMN user_id;

-- Add new primary key which uses entity_id
ALTER TABLE guacamole_connection_group_permission
    ADD PRIMARY KEY (entity_id, connection_group_id, permission);

--
-- Modify guacamole_sharing_profile_permission to use guacamole_entity instead
-- of guacamole_user
--

-- Add new entity_id column
ALTER TABLE guacamole_sharing_profile_permission ADD COLUMN entity_id int(11);

-- Update guacamole_sharing_profile_permission to point to the guacamole_entity
-- that has been granted the permission
UPDATE guacamole_sharing_profile_permission SET entity_id = (
    SELECT entity_id FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_sharing_profile_permission.user_id
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_sharing_profile_permission MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_sharing_profile_permission
    ADD CONSTRAINT guacamole_sharing_profile_permission_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- Remove user_id column
ALTER TABLE guacamole_sharing_profile_permission DROP FOREIGN KEY guacamole_sharing_profile_permission_ibfk_2;
ALTER TABLE guacamole_sharing_profile_permission DROP PRIMARY KEY;
ALTER TABLE guacamole_sharing_profile_permission DROP COLUMN user_id;

-- Add new primary key which uses entity_id
ALTER TABLE guacamole_sharing_profile_permission
    ADD PRIMARY KEY (entity_id, sharing_profile_id, permission);

--
-- Modify guacamole_user_permission to use guacamole_entity instead of
-- guacamole_user
--

-- Add new entity_id column
ALTER TABLE guacamole_user_permission ADD COLUMN entity_id int(11);

-- Update guacamole_user_permission to point to the guacamole_entity
-- that has been granted the permission
UPDATE guacamole_user_permission SET entity_id = (
    SELECT entity_id FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_user_permission.user_id
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_user_permission MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_user_permission
    ADD CONSTRAINT guacamole_user_permission_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- Remove user_id column
ALTER TABLE guacamole_user_permission DROP FOREIGN KEY guacamole_user_permission_ibfk_2;
ALTER TABLE guacamole_user_permission DROP PRIMARY KEY;
ALTER TABLE guacamole_user_permission DROP COLUMN user_id;

-- Add new primary key which uses entity_id
ALTER TABLE guacamole_user_permission
    ADD PRIMARY KEY (entity_id, affected_user_id, permission);

--
-- Modify guacamole_system_permission to use guacamole_entity instead of
-- guacamole_user
--

-- Add new entity_id column
ALTER TABLE guacamole_system_permission ADD COLUMN entity_id int(11);

-- Update guacamole_system_permission to point to the guacamole_entity
-- that has been granted the permission
UPDATE guacamole_system_permission SET entity_id = (
    SELECT entity_id FROM guacamole_user
    WHERE guacamole_user.user_id = guacamole_system_permission.user_id
);

-- The entity_id column should now be safely non-NULL
ALTER TABLE guacamole_system_permission MODIFY entity_id int(11) NOT NULL;

-- The entity_id column should now safely point to guacamole_entity entries
ALTER TABLE guacamole_system_permission
    ADD CONSTRAINT guacamole_system_permission_entity
    FOREIGN KEY (entity_id)
    REFERENCES guacamole_entity (entity_id)
    ON DELETE CASCADE;

-- Remove user_id column
ALTER TABLE guacamole_system_permission DROP FOREIGN KEY guacamole_system_permission_ibfk_1;
ALTER TABLE guacamole_system_permission DROP PRIMARY KEY;
ALTER TABLE guacamole_system_permission DROP COLUMN user_id;

-- Add new primary key which uses entity_id
ALTER TABLE guacamole_system_permission
    ADD PRIMARY KEY (entity_id, permission);

--
-- Table of arbitrary user attributes. Each attribute is simply a name/value
-- pair associated with a user. Arbitrary attributes are defined by other
-- extensions. Attributes defined by this extension will be mapped to
-- properly-typed columns of a specific table.
--

CREATE TABLE guacamole_user_attribute (

  `user_id`         int(11)       NOT NULL,
  `attribute_name`  varchar(128)  NOT NULL,
  `attribute_value` varchar(4096) NOT NULL,

  PRIMARY KEY (user_id, attribute_name),
  KEY `user_id` (`user_id`),

  CONSTRAINT guacamole_user_attribute_ibfk_1
    FOREIGN KEY (user_id)
    REFERENCES guacamole_user (user_id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of arbitrary user group attributes. Each attribute is simply a
-- name/value pair associated with a user group. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE guacamole_user_group_attribute (

  `user_group_id`   int(11)       NOT NULL,
  `attribute_name`  varchar(128)  NOT NULL,
  `attribute_value` varchar(4096) NOT NULL,

  PRIMARY KEY (`user_group_id`, `attribute_name`),
  KEY `user_group_id` (`user_group_id`),

  CONSTRAINT `guacamole_user_group_attribute_ibfk_1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `guacamole_user_group` (`user_group_id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of arbitrary connection attributes. Each attribute is simply a
-- name/value pair associated with a connection. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE guacamole_connection_attribute (

  `connection_id`   int(11)       NOT NULL,
  `attribute_name`  varchar(128)  NOT NULL,
  `attribute_value` varchar(4096) NOT NULL,

  PRIMARY KEY (connection_id, attribute_name),
  KEY `connection_id` (`connection_id`),

  CONSTRAINT guacamole_connection_attribute_ibfk_1
    FOREIGN KEY (connection_id)
    REFERENCES guacamole_connection (connection_id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of arbitrary connection group attributes. Each attribute is simply a
-- name/value pair associated with a connection group. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE guacamole_connection_group_attribute (

  `connection_group_id` int(11)       NOT NULL,
  `attribute_name`      varchar(128)  NOT NULL,
  `attribute_value`     varchar(4096) NOT NULL,

  PRIMARY KEY (connection_group_id, attribute_name),
  KEY `connection_group_id` (`connection_group_id`),

  CONSTRAINT guacamole_connection_group_attribute_ibfk_1
    FOREIGN KEY (connection_group_id)
    REFERENCES guacamole_connection_group (connection_group_id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Table of arbitrary sharing profile attributes. Each attribute is simply a
-- name/value pair associated with a sharing profile. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE guacamole_sharing_profile_attribute (

  `sharing_profile_id` int(11)       NOT NULL,
  `attribute_name`     varchar(128)  NOT NULL,
  `attribute_value`    varchar(4096) NOT NULL,

  PRIMARY KEY (sharing_profile_id, attribute_name),
  KEY `sharing_profile_id` (`sharing_profile_id`),

  CONSTRAINT guacamole_sharing_profile_attribute_ibfk_1
    FOREIGN KEY (sharing_profile_id)
    REFERENCES guacamole_sharing_profile (sharing_profile_id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8;
