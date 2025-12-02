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
-- Add per-user time-based access restrictions.
--

ALTER TABLE guacamole_user ADD COLUMN access_window_start    TIME;
ALTER TABLE guacamole_user ADD COLUMN access_window_end      TIME;

--
-- Add per-user date-based account validity restrictions.
--

ALTER TABLE guacamole_user ADD COLUMN valid_from  DATE;
ALTER TABLE guacamole_user ADD COLUMN valid_until DATE;

--
-- Add per-user timezone for sake of time comparisons/interpretation.
--

ALTER TABLE guacamole_user ADD COLUMN timezone VARCHAR(64);

--
-- Add connection concurrency limits
--

ALTER TABLE guacamole_connection ADD COLUMN max_connections          INT(11);
ALTER TABLE guacamole_connection ADD COLUMN max_connections_per_user INT(11);

--
-- Add connection group concurrency limits
--

ALTER TABLE guacamole_connection_group ADD COLUMN max_connections          INT(11);
ALTER TABLE guacamole_connection_group ADD COLUMN max_connections_per_user INT(11);
