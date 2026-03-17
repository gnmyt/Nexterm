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
-- Add new system-level audit permission
--

EXEC sp_unbindrule 'guacamole_system_permission';
DROP RULE [guacamole_system_permission_list];
GO

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

EXEC sp_bindrule
    'guacamole_system_permission_list',
    'guacamole_system_permission';
GO

