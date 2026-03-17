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
-- Connection group types
--

CREATE RULE [guacamole_connection_group_type_list] AS @list IN (
    'ORGANIZATIONAL',
    'BALANCING'
);
GO

CREATE TYPE [guacamole_connection_group_type] FROM [nvarchar](16);
EXEC sp_bindrule
    'guacamole_connection_group_type_list',
    'guacamole_connection_group_type';
GO

--
-- Entity types
--

CREATE RULE [guacamole_entity_type_list] AS @list IN (
    'USER',
    'USER_GROUP'
);
GO

CREATE TYPE [guacamole_entity_type] FROM [nvarchar](16);
EXEC sp_bindrule
    'guacamole_entity_type_list',
    'guacamole_entity_type';
GO

--
-- Object permission types
--

CREATE RULE [guacamole_object_permission_list] AS @list IN (
    'READ',
    'UPDATE',
    'DELETE',
    'ADMINISTER'
);
GO

CREATE TYPE [guacamole_object_permission] FROM [nvarchar](16);
EXEC sp_bindrule
    'guacamole_object_permission_list',
    'guacamole_object_permission';
GO

--
-- System permission types
--

CREATE RULE [guacamole_system_permission_list] AS @list IN (
    'CREATE_CONNECTION',
    'CREATE_CONNECTION_GROUP',
    'CREATE_SHARING_PROFILE',
    'CREATE_USER',
    'CREATE_USER_GROUP',
    'AUDIT',
    'ADMINISTER'
);
GO

CREATE TYPE [guacamole_system_permission] FROM [nvarchar](32);
EXEC sp_bindrule
    'guacamole_system_permission_list',
    'guacamole_system_permission';
GO

--
-- Guacamole proxy (guacd) encryption methods.
--

CREATE RULE [guacamole_proxy_encryption_method_list] AS @list IN (
    'NONE',
    'SSL'
);
GO

CREATE TYPE [guacamole_proxy_encryption_method] FROM [nvarchar](8);
EXEC sp_bindrule
    'guacamole_proxy_encryption_method_list',
    'guacamole_proxy_encryption_method';
GO

--
-- Table of connection groups. Each connection group has a name, type, and
-- optional parent connection group.
--

CREATE TABLE [guacamole_connection_group] (

    [connection_group_id]   [int] IDENTITY(1,1) NOT NULL,
    [parent_id]             [int],
    [connection_group_name] [nvarchar](128)     NOT NULL,
    [type]                  [guacamole_connection_group_type]
                            NOT NULL DEFAULT 'ORGANIZATIONAL',

    -- Concurrency limits
    [max_connections]          [int],
    [max_connections_per_user] [int],
    [enable_session_affinity]  [bit] NOT NULL DEFAULT 0,

    CONSTRAINT [PK_guacamole_connection_group]
        PRIMARY KEY CLUSTERED ([connection_group_id]),

    CONSTRAINT [AK_guacamole_connection_group_name_parent]
        UNIQUE ([connection_group_name], [parent_id]),

    CONSTRAINT [FK_guacamole_connection_group_parent_id]
        FOREIGN KEY ([parent_id])
        REFERENCES [guacamole_connection_group] ([connection_group_id])
        -- ON DELETE CASCADE handled by guacamole_delete_connection_group trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_group_parent_id]
    ON [guacamole_connection_group] ([parent_id]);
GO

--
-- Table of connections. Each connection has a name, protocol, and
-- associated set of parameters. A connection may belong to a connection group.
--

CREATE TABLE [guacamole_connection] (

    [connection_id]   [int] IDENTITY(1,1) NOT NULL,
    [connection_name] [nvarchar](128)     NOT NULL,
    [parent_id]       [int],
    [protocol]        [nvarchar](32)      NOT NULL,

    -- Concurrency limits
    [max_connections]          [int],
    [max_connections_per_user] [int],

    -- Connection Weight
    [connection_weight] [int],
    [failover_only]     [bit] NOT NULL DEFAULT 0,

    -- Guacamole proxy (guacd) overrides
    [proxy_port]              [int],
    [proxy_hostname]          [nvarchar](512),
    [proxy_encryption_method] [guacamole_proxy_encryption_method],

    CONSTRAINT [PK_guacamole_connection]
        PRIMARY KEY CLUSTERED ([connection_id]),

    CONSTRAINT [AK_guacamole_connection_name_parent]
        UNIQUE ([connection_name], [parent_id]),

    CONSTRAINT [FK_guacamole_connection_parent_id]
        FOREIGN KEY ([parent_id])
        REFERENCES [guacamole_connection_group] ([connection_group_id])
        -- ON DELETE CASCADE handled by guacamole_delete_connection_group trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_parent_id]
    ON [guacamole_connection] ([parent_id]);
GO

--
-- Table of base entities which may each be either a user or user group. Other
-- tables which represent qualities shared by both users and groups will point
-- to guacamole_entity, while tables which represent qualities specific to
-- users or groups will point to guacamole_user or guacamole_user_group.
--

CREATE TABLE [guacamole_entity] (

    [entity_id]     [int] IDENTITY(1,1)     NOT NULL,
    [name]          [nvarchar](128)         NOT NULL,
    [type]          [guacamole_entity_type] NOT NULL,

    CONSTRAINT [PK_guacamole_entity]
        PRIMARY KEY CLUSTERED ([entity_id]),

    CONSTRAINT [AK_guacamole_entity_name_scope]
        UNIQUE ([type], [name])

);
GO

--
-- Table of users. Each user has a unique username and a hashed password
-- with corresponding salt. Although the authentication system will always set
-- salted passwords, other systems may set unsalted passwords by simply not
-- providing the salt.
--

CREATE TABLE [guacamole_user] (

    [user_id]   [int] IDENTITY(1,1) NOT NULL,
    [entity_id] [int]               NOT NULL,

    -- Optionally-salted password
    [password_hash] [binary](32)    NOT NULL,
    [password_salt] [binary](32),
    [password_date] [datetime]      NOT NULL,

    -- Account disabled/expired status
    [disabled] [bit] NOT NULL DEFAULT 0,
    [expired]  [bit] NOT NULL DEFAULT 0,

    -- Time-based access restriction
    [access_window_start] [time](7),
    [access_window_end]   [time](7),

    -- Date-based access restriction
    [valid_from]  [date],
    [valid_until] [date],

    -- Timezone used for all date/time comparisons and interpretation
    [timezone] [nvarchar](64),

    -- Profile information
    [full_name]           [nvarchar](256),
    [email_address]       [nvarchar](256),
    [organization]        [nvarchar](256),
    [organizational_role] [nvarchar](256),

    CONSTRAINT [PK_guacamole_user]
        PRIMARY KEY CLUSTERED ([user_id]),

    CONSTRAINT [AK_guacamole_user_single_entity]
        UNIQUE ([entity_id]),

    CONSTRAINT [FK_guacamole_user_entity]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);
GO

--
-- Table of user groups. Each user group may have an arbitrary set of member
-- users and member groups, with those members inheriting the permissions
-- granted to that group.
--

CREATE TABLE [guacamole_user_group] (

    [user_group_id] [int] IDENTITY(1,1) NOT NULL,
    [entity_id]     [int]               NOT NULL,

    -- Group disabled status
    [disabled] [bit] NOT NULL DEFAULT 0,

    CONSTRAINT [PK_guacamole_user_group]
        PRIMARY KEY CLUSTERED ([user_group_id]),

    CONSTRAINT [guacamole_user_group_single_entity]
        UNIQUE ([entity_id]),

    CONSTRAINT [guacamole_user_group_entity]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);
GO

--
-- Table of users which are members of given user groups.
--

CREATE TABLE [guacamole_user_group_member] (

    [user_group_id]    [int] NOT NULL,
    [member_entity_id] [int] NOT NULL,

    CONSTRAINT [PK_guacamole_user_group_member]
        PRIMARY KEY CLUSTERED ([user_group_id], [member_entity_id]),

    -- Parent must be a user group
    CONSTRAINT [guacamole_user_group_member_parent_id]
        FOREIGN KEY ([user_group_id])
        REFERENCES [guacamole_user_group] ([user_group_id])
        ON DELETE CASCADE,

    -- Member may be either a user or a user group (any entity)
    CONSTRAINT [guacamole_user_group_member_entity_id]
        FOREIGN KEY ([member_entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        -- ON DELETE CASCADE handled by guacamole_delete_entity trigger

);
GO

--
-- Table of sharing profiles. Each sharing profile has a name, associated set
-- of parameters, and a primary connection. The primary connection is the
-- connection that the sharing profile shares, and the parameters dictate the
-- restrictions/features which apply to the user joining the connection via the
-- sharing profile.
--

CREATE TABLE [guacamole_sharing_profile] (

    [sharing_profile_id]    [int] IDENTITY(1,1) NOT NULL,
    [sharing_profile_name]  [nvarchar](128)     NOT NULL,
    [primary_connection_id] [int]               NOT NULL,

    CONSTRAINT [PK_guacamole_sharing_profile]
        PRIMARY KEY CLUSTERED ([sharing_profile_id]),

    CONSTRAINT [AK_guacamole_sharing_profile_name_primary_connection]
        UNIQUE ([sharing_profile_name], [primary_connection_id]),

    CONSTRAINT [FK_guacamole_sharing_profile_primary_connection_id]
        FOREIGN KEY ([primary_connection_id])
        REFERENCES [guacamole_connection] ([connection_id])
        -- ON DELETE CASCADE handled by guacamole_delete_connection trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_sharing_profile_primary_connection_id]
    ON [guacamole_sharing_profile] ([primary_connection_id]);
GO

--
-- Table of arbitrary user attributes. Each attribute is simply a name/value
-- pair associated with a user. Arbitrary attributes are defined by other
-- extensions. Attributes defined by this extension will be mapped to
-- properly-typed columns of a specific table.
--

CREATE TABLE [guacamole_user_attribute] (

    [user_id]         [int]            NOT NULL,
    [attribute_name]  [nvarchar](128)  NOT NULL,
    [attribute_value] [nvarchar](4000) NOT NULL,

    CONSTRAINT [PK_guacamole_user_attribute]
        PRIMARY KEY CLUSTERED ([user_id], [attribute_name]),

    CONSTRAINT [FK_guacamole_user_attribute_user_id]
        FOREIGN KEY ([user_id])
        REFERENCES [guacamole_user] ([user_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_attribute_user_id]
    ON [guacamole_user_attribute] ([user_id])
    INCLUDE ([attribute_name], [attribute_value]);
GO

--
-- Table of arbitrary user group attributes. Each attribute is simply a
-- name/value pair associated with a user group. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE [guacamole_user_group_attribute] (

    [user_group_id]   [int]            NOT NULL,
    [attribute_name]  [nvarchar](128)  NOT NULL,
    [attribute_value] [nvarchar](4000) NOT NULL,

    CONSTRAINT [PK_guacamole_user_group_attribute]
        PRIMARY KEY CLUSTERED ([user_group_id], [attribute_name]),

    CONSTRAINT [FK_guacamole_user_attribute_user_group_id]
        FOREIGN KEY ([user_group_id])
        REFERENCES [guacamole_user_group] ([user_group_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_group_attribute_user_id]
    ON [guacamole_user_group_attribute] ([user_group_id])
    INCLUDE ([attribute_name], [attribute_value]);
GO

--
-- Table of arbitrary connection attributes. Each attribute is simply a
-- name/value pair associated with a connection. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE [guacamole_connection_attribute] (

    [connection_id]   [int]            NOT NULL,
    [attribute_name]  [nvarchar](128)  NOT NULL,
    [attribute_value] [nvarchar](4000) NOT NULL,

    PRIMARY KEY (connection_id, attribute_name),

    CONSTRAINT [FK_guacamole_connection_attribute_connection_id]
        FOREIGN KEY ([connection_id])
        REFERENCES [guacamole_connection] ([connection_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_attribute_connection_id]
    ON [guacamole_connection_attribute] ([connection_id])
    INCLUDE ([attribute_name], [attribute_value]);
GO

--
-- Table of arbitrary connection group attributes. Each attribute is simply a
-- name/value pair associated with a connection group. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE [guacamole_connection_group_attribute] (

    [connection_group_id] [int]            NOT NULL,
    [attribute_name]      [nvarchar](128)  NOT NULL,
    [attribute_value]     [nvarchar](4000) NOT NULL,

    PRIMARY KEY (connection_group_id, attribute_name),

    CONSTRAINT [FK_guacamole_connection_group_attribute_connection_group_id]
        FOREIGN KEY ([connection_group_id])
        REFERENCES [guacamole_connection_group] ([connection_group_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_group_attribute_connection_group_id]
    ON [guacamole_connection_group_attribute] ([connection_group_id])
    INCLUDE ([attribute_name], [attribute_value]);
GO

--
-- Table of arbitrary sharing profile attributes. Each attribute is simply a
-- name/value pair associated with a sharing profile. Arbitrary attributes are
-- defined by other extensions. Attributes defined by this extension will be
-- mapped to properly-typed columns of a specific table.
--

CREATE TABLE [guacamole_sharing_profile_attribute] (

    [sharing_profile_id] [int]            NOT NULL,
    [attribute_name]     [nvarchar](128)  NOT NULL,
    [attribute_value]    [nvarchar](4000) NOT NULL,

    PRIMARY KEY (sharing_profile_id, attribute_name),

    CONSTRAINT [FK_guacamole_sharing_profile_attribute_sharing_profile_id]
        FOREIGN KEY ([sharing_profile_id])
        REFERENCES [guacamole_sharing_profile] ([sharing_profile_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_sharing_profile_attribute_sharing_profile_id]
    ON [guacamole_sharing_profile_attribute] ([sharing_profile_id])
    INCLUDE ([attribute_name], [attribute_value]);
GO

--
-- Table of connection parameters. Each parameter is simply a name/value pair
-- associated with a connection.
--

CREATE TABLE [guacamole_connection_parameter] (

    [connection_id]   [int]            NOT NULL,
    [parameter_name]  [nvarchar](128)  NOT NULL,
    [parameter_value] [nvarchar](4000) NOT NULL,

    CONSTRAINT [PK_guacamole_connection_parameter]
        PRIMARY KEY CLUSTERED ([connection_id], [parameter_name]),

    CONSTRAINT [FK_guacamole_connection_parameter_connection_id]
        FOREIGN KEY ([connection_id])
        REFERENCES [guacamole_connection] ([connection_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_parameter_connection_id]
    ON [guacamole_connection_parameter] ([connection_id]);
GO

--
-- Table of sharing profile parameters. Each parameter is simply
-- name/value pair associated with a sharing profile. These parameters dictate
-- the restrictions/features which apply to the user joining the associated
-- connection via the sharing profile.
--

CREATE TABLE [guacamole_sharing_profile_parameter] (

    [sharing_profile_id] [int]            NOT NULL,
    [parameter_name]     [nvarchar](128)  NOT NULL,
    [parameter_value]    [nvarchar](4000) NOT NULL,

    CONSTRAINT [PK_guacamole_sharing_profile_parameter]
        PRIMARY KEY CLUSTERED ([sharing_profile_id], [parameter_name]),

    CONSTRAINT [FK_guacamole_sharing_profile_parameter_connection_id]
        FOREIGN KEY ([sharing_profile_id])
        REFERENCES [guacamole_sharing_profile] ([sharing_profile_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_sharing_profile_parameter_sharing_profile_id]
    ON [guacamole_sharing_profile_parameter] ([sharing_profile_id]);
GO

--
-- Table of connection permissions. Each connection permission grants a user or
-- user group specific access to a connection.
--

CREATE TABLE [guacamole_connection_permission] (

    [entity_id]     [int]                         NOT NULL,
    [connection_id] [int]                         NOT NULL,
    [permission]    [guacamole_object_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_connection_permission]
        PRIMARY KEY CLUSTERED  ([entity_id], [connection_id], [permission]),

    CONSTRAINT [FK_guacamole_connection_permission_connection_id]
        FOREIGN KEY ([connection_id])
        REFERENCES [guacamole_connection] ([connection_id])
        ON DELETE CASCADE,

    CONSTRAINT [FK_guacamole_connection_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_permission_connection_id]
    ON [guacamole_connection_permission] ([connection_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_permission_entity_id]
    ON [guacamole_connection_permission] ([entity_id]);
GO

--
-- Table of connection group permissions. Each group permission grants a user
-- or user group specific access to a connection group.
--

CREATE TABLE [guacamole_connection_group_permission] (

    [entity_id]           [int]                         NOT NULL,
    [connection_group_id] [int]                         NOT NULL,
    [permission]          [guacamole_object_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_connection_group_permission]
        PRIMARY KEY CLUSTERED ([entity_id], [connection_group_id], [permission]),

    CONSTRAINT [FK_guacamole_connection_group_permission_connection_group_id]
        FOREIGN KEY ([connection_group_id])
        REFERENCES [guacamole_connection_group] ([connection_group_id])
        ON DELETE CASCADE,

    CONSTRAINT [FK_guacamole_connection_group_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_group_permission_connection_group_id]
    ON [guacamole_connection_group_permission] ([connection_group_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_group_permission_entity_id]
    ON [guacamole_connection_group_permission] ([entity_id]);
GO

--
-- Table of sharing profile permissions. Each sharing profile permission grants
-- a user or user group specific access to a sharing profile.
--

CREATE TABLE [guacamole_sharing_profile_permission] (

    [entity_id]          [int]                         NOT NULL,
    [sharing_profile_id] [int]                         NOT NULL,
    [permission]         [guacamole_object_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_sharing_profile_permission]
        PRIMARY KEY CLUSTERED ([entity_id], [sharing_profile_id], [permission]),

    CONSTRAINT [FK_guacamole_sharing_profile_permission_sharing_profile_id]
        FOREIGN KEY ([sharing_profile_id])
        REFERENCES [guacamole_sharing_profile] ([sharing_profile_id])
        ON DELETE CASCADE,

    CONSTRAINT [FK_guacamole_sharing_profile_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_sharing_profile_permission_sharing_profile_id]
    ON [guacamole_sharing_profile_permission] ([sharing_profile_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_sharing_profile_permission_entity_id]
    ON [guacamole_sharing_profile_permission] ([entity_id]);
GO

--
-- Table of system permissions. Each system permission grants a user or user
-- group a system-level privilege of some kind.
--

CREATE TABLE [guacamole_system_permission] (

    [entity_id]  [int]                         NOT NULL,
    [permission] [guacamole_system_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_system_permission]
        PRIMARY KEY CLUSTERED ([entity_id], [permission]),

    CONSTRAINT [FK_guacamole_system_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_system_permission_entity_id]
    ON [guacamole_system_permission] ([entity_id]);
GO

--
-- Table of user permissions. Each user permission grants a user or user group
-- access to another user (the "affected" user) for a specific type of
-- operation.
--

CREATE TABLE [guacamole_user_permission] (

    [entity_id]        [int]                         NOT NULL,
    [affected_user_id] [int]                         NOT NULL,
    [permission]       [guacamole_object_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_user_permission]
        PRIMARY KEY CLUSTERED ([entity_id], [affected_user_id], [permission]),

    CONSTRAINT [FK_guacamole_user_permission_affected_user_id]
        FOREIGN KEY ([affected_user_id])
        REFERENCES [guacamole_user] ([user_id])
        ON DELETE CASCADE,

    CONSTRAINT [FK_guacamole_user_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        -- ON DELETE CASCADE handled by guacamole_delete_entity trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_permission_entity_id]
    ON [guacamole_user_permission] ([entity_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_permission_affected_user_id]
    ON [guacamole_user_permission] ([affected_user_id]);
GO

--
-- Table of user group permissions. Each user group permission grants a user
-- or user group access to a another user group (the "affected" user group) for
-- a specific type of operation.
--

CREATE TABLE [guacamole_user_group_permission] (

    [entity_id]              [int]                         NOT NULL,
    [affected_user_group_id] [int]                         NOT NULL,
    [permission]             [guacamole_object_permission] NOT NULL,

    CONSTRAINT [PK_guacamole_user_group_permission]
        PRIMARY KEY CLUSTERED ([entity_id], [affected_user_group_id], [permission]),

    CONSTRAINT [FK_guacamole_user_group_permission_affected_user_group_id]
        FOREIGN KEY ([affected_user_group_id])
        REFERENCES [guacamole_user_group] ([user_group_id])
        ON DELETE CASCADE,

    CONSTRAINT [FK_guacamole_user_group_permission_entity_id]
        FOREIGN KEY ([entity_id])
        REFERENCES [guacamole_entity] ([entity_id])
        -- ON DELETE CASCADE handled by guacamole_delete_entity trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_group_permission_entity_id]
    ON [guacamole_user_group_permission] ([entity_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_group_permission_affected_user_group_id]
    ON [guacamole_user_group_permission] ([affected_user_group_id]);
GO

--
-- Table of connection history records. Each record defines a specific user's
-- session, including the connection used, the start time, and the end time
-- (if any).
--

CREATE TABLE [guacamole_connection_history] (

    [history_id]           [int] IDENTITY(1,1) NOT NULL,
    [user_id]              [int],
    [username]             [nvarchar](128)     NOT NULL,
    [remote_host]          [nvarchar](256),
    [connection_id]        [int],
    [connection_name]      [nvarchar](128)     NOT NULL,
    [sharing_profile_id]   [int],
    [sharing_profile_name] [nvarchar](128),
    [start_date]           [datetime]          NOT NULL,
    [end_date]             [datetime],

    CONSTRAINT [PK_guacamole_connection_history]
        PRIMARY KEY CLUSTERED ([history_id]),

    CONSTRAINT [FK_guacamole_connection_history_user_id]
        FOREIGN KEY ([user_id])
        REFERENCES [guacamole_user] ([user_id])
        ON DELETE SET NULL,

    CONSTRAINT [FK_guacamole_connection_history_connection_id]
        FOREIGN KEY ([connection_id])
        REFERENCES [guacamole_connection] ([connection_id])
        ON DELETE SET NULL,

    CONSTRAINT [FK_guacamole_connection_history_sharing_profile_id]
        FOREIGN KEY ([sharing_profile_id])
        REFERENCES [guacamole_sharing_profile] ([sharing_profile_id])
        -- ON DELETE SET NULL handled by guacamole_delete_sharing profile trigger

);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_user_id]
    ON [guacamole_connection_history] ([user_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_connection_id]
    ON [guacamole_connection_history] ([connection_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_sharing_profile_id]
    ON [guacamole_connection_history] ([sharing_profile_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_start_date]
    ON [guacamole_connection_history] ([start_date]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_end_date]
    ON [guacamole_connection_history] ([end_date]);

CREATE NONCLUSTERED INDEX [IX_guacamole_connection_history_connection_id_start_date]
    ON [guacamole_connection_history] ([connection_id], [start_date]);
GO

--
-- User login/logout history
--

CREATE TABLE [guacamole_user_history] (

    [history_id]           [int] IDENTITY(1,1) NOT NULL,
    [user_id]              [int]               DEFAULT NULL,
    [username]             [nvarchar](128)     NOT NULL,
    [remote_host]          [nvarchar](256)     DEFAULT NULL,
    [start_date]           [datetime]          NOT NULL,
    [end_date]             [datetime]          DEFAULT NULL,

    PRIMARY KEY (history_id),

    CONSTRAINT FK_guacamole_user_history_user_id
        FOREIGN KEY (user_id)
        REFERENCES guacamole_user (user_id) ON DELETE SET NULL

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_history_user_id]
    ON [guacamole_user_history] ([user_id]);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_history_start_date]
    ON [guacamole_user_history] ([start_date]);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_history_end_date]
    ON [guacamole_user_history] ([end_date]);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_history_user_id_start_date]
    ON [guacamole_user_history] ([user_id], [start_date]);
GO

--
-- The user_password_history table stores password history
-- for users, allowing for enforcing rules associated with
-- reuse of passwords.
--

CREATE TABLE [guacamole_user_password_history] (

    [password_history_id] [int] IDENTITY(1,1) NOT NULL,
    [user_id]             [int]               NOT NULL,

    -- Salted password
    [password_hash] [binary](32) NOT NULL,
    [password_salt] [binary](32),
    [password_date] [datetime]   NOT NULL,

    CONSTRAINT [PK_guacamole_user_password_history]
        PRIMARY KEY CLUSTERED ([password_history_id]),

    CONSTRAINT [FK_guacamole_user_password_history_user_id]
        FOREIGN KEY ([user_id])
        REFERENCES [guacamole_user] ([user_id])
        ON DELETE CASCADE

);

CREATE NONCLUSTERED INDEX [IX_guacamole_user_password_history_user_id]
    ON [guacamole_user_password_history] ([user_id]);
GO

--
-- Handle cascading deletion/updates of records in response to deletion of
-- guacamole_entity records, where such deletion is not already covered by
-- ON DELETE CASCADE or ON DELETE SET NULL.
--

CREATE TRIGGER [guacamole_delete_entity]
   ON [guacamole_entity]
   INSTEAD OF DELETE
AS BEGIN

    -- Do not take trigger into account when producing row counts for the DELETE
    SET NOCOUNT ON;

    -- Delete all associated permissions not covered by ON DELETE CASCADE
    DELETE FROM [guacamole_user_permission]
    WHERE [entity_id] IN (SELECT [entity_id] FROM DELETED);

    DELETE FROM [guacamole_user_group_permission]
    WHERE [entity_id] IN (SELECT [entity_id] FROM DELETED);

    -- Delete all associated group memberships not covered by ON DELETE CASCADE
    DELETE FROM [guacamole_user_group_member]
    WHERE [member_entity_id] IN (SELECT [entity_id] FROM DELETED);

    -- Perform original deletion
    DELETE FROM [guacamole_entity]
    WHERE [entity_id] IN (SELECT [entity_id] FROM DELETED);

END
GO

--
-- Handle cascading deletion/updates of records in response to deletion of
-- guacamole_connection records, where such deletion is not already covered by
-- ON DELETE CASCADE or ON DELETE SET NULL.
--

CREATE TRIGGER [guacamole_delete_connection]
   ON [guacamole_connection]
   INSTEAD OF DELETE
AS BEGIN

    -- Do not take trigger into account when producing row counts for the DELETE
    SET NOCOUNT ON;

    -- Delete associated sharing profiles
    DELETE FROM [guacamole_sharing_profile]
    WHERE [primary_connection_id] IN (SELECT [connection_id] FROM DELETED);

    -- Perform original deletion
    DELETE FROM [guacamole_connection]
    WHERE [connection_id] IN (SELECT [connection_id] FROM DELETED);

END
GO

--
-- Handle cascading deletion/updates of records in response to deletion of
-- guacamole_connection_group records, where such deletion is not already
-- covered by ON DELETE CASCADE or ON DELETE SET NULL.
--

CREATE TRIGGER [guacamole_delete_connection_group]
   ON [guacamole_connection_group]
   INSTEAD OF DELETE
AS BEGIN

    -- Do not take trigger into account when producing row counts for the DELETE
    SET NOCOUNT ON;

    -- Delete all descendant connections
    WITH [connection_groups] ([connection_group_id]) AS (
        SELECT [connection_group_id] FROM DELETED
    UNION ALL
        SELECT [guacamole_connection_group].[connection_group_id]
        FROM [guacamole_connection_group]
        JOIN [connection_groups] ON [connection_groups].[connection_group_id] = [guacamole_connection_group].[parent_id]
    )
    DELETE FROM [guacamole_connection]
    WHERE [parent_id] IN (
        SELECT [connection_group_id]
        FROM [connection_groups]
    );

    -- Delete all requested connection groups, including descendants
    WITH [connection_groups] ([connection_group_id]) AS (
        SELECT [connection_group_id] FROM DELETED
    UNION ALL
        SELECT [guacamole_connection_group].[connection_group_id]
        FROM [guacamole_connection_group]
        JOIN [connection_groups] ON [connection_groups].[connection_group_id] = [guacamole_connection_group].[parent_id]
    )
    DELETE FROM [guacamole_connection_group]
    WHERE [connection_group_id] IN (
        SELECT [connection_group_id]
        FROM [connection_groups]
    );

END
GO

--
-- Handle cascading deletion/updates of records in response to deletion of
-- guacamole_sharing_profile records, where such deletion is not already
-- covered by ON DELETE CASCADE or ON DELETE SET NULL.
--

CREATE TRIGGER [guacamole_delete_sharing_profile]
   ON [guacamole_sharing_profile]
   INSTEAD OF DELETE
AS BEGIN

    -- Do not take trigger into account when producing row counts for the DELETE
    SET NOCOUNT ON;

    -- Delete all associated permissions not covered by ON DELETE CASCADE
    UPDATE [guacamole_connection_history]
    SET [sharing_profile_id] = NULL
    WHERE [sharing_profile_id] IN (SELECT [sharing_profile_id] FROM DELETED);

    -- Perform original deletion
    DELETE FROM [guacamole_sharing_profile]
    WHERE [sharing_profile_id] IN (SELECT [sharing_profile_id] FROM DELETED);

END
GO

