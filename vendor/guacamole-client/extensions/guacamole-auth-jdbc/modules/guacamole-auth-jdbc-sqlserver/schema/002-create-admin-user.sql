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

-- Create default user "guacadmin" with password "guacadmin"
INSERT INTO [guacamole_entity] ([name], [type]) VALUES ('guacadmin', 'USER');
INSERT INTO [guacamole_user] (
    [entity_id],
    [password_hash],
    [password_salt],
    [password_date]
)
SELECT
    [entity_id],
    0xCA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960,
    0xFE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264,
    getdate()
FROM [guacamole_entity] WHERE [name] = 'guacadmin';

-- Grant this user all system permissions
INSERT INTO [guacamole_system_permission]
SELECT
    [entity_id],
    [permission]
FROM (
          SELECT 'guacadmin', 'CREATE_CONNECTION'
    UNION SELECT 'guacadmin', 'CREATE_CONNECTION_GROUP'
    UNION SELECT 'guacadmin', 'CREATE_SHARING_PROFILE'
    UNION SELECT 'guacadmin', 'CREATE_USER'
    UNION SELECT 'guacadmin', 'CREATE_USER_GROUP'
    UNION SELECT 'guacadmin', 'ADMINISTER'
) [permissions] ([username], [permission])
JOIN [guacamole_entity] ON [permissions].[username] = [guacamole_entity].[name] AND [guacamole_entity].[type] = 'USER';

INSERT INTO [guacamole_user_permission]
SELECT
    [guacamole_entity].[entity_id],
    [guacamole_user].[user_id],
    [permission]
FROM (
          SELECT 'guacadmin', 'guacadmin', 'READ'
    UNION SELECT 'guacadmin', 'guacadmin', 'UPDATE'
    UNION SELECT 'guacadmin', 'guacadmin', 'ADMINISTER'
) [permissions] ([username], [affected_username], [permission])
JOIN [guacamole_entity]            ON [permissions].[username] = [guacamole_entity].[name] AND [guacamole_entity].[type] = 'USER'
JOIN [guacamole_entity] [affected] ON [permissions].[affected_username] = [affected].[name] AND [guacamole_entity].[type] = 'USER'
JOIN [guacamole_user]              ON [guacamole_user].[entity_id] = [affected].[entity_id];
GO

