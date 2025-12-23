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
-- Add per-connection weight
--

ALTER TABLE guacamole_connection
    ADD COLUMN connection_weight int;

--
-- Add failover-only flag
--

ALTER TABLE guacamole_connection
    ADD COLUMN failover_only BOOLEAN NOT NULL DEFAULT FALSE;

--
-- Add remote_host to connection history
--

ALTER TABLE guacamole_connection_history
    ADD COLUMN remote_host VARCHAR(256) DEFAULT NULL;

--
-- Add covering index for connection history connection and start date
--

CREATE INDEX guacamole_connection_history_connection_id_start_date
    ON guacamole_connection_history(connection_id, start_date);

--
-- User login/logout history
--

CREATE TABLE guacamole_user_history (

  history_id           serial       NOT NULL,
  user_id              integer      DEFAULT NULL,
  username             varchar(128) NOT NULL,
  remote_host          varchar(256) DEFAULT NULL,
  start_date           timestamptz  NOT NULL,
  end_date             timestamptz  DEFAULT NULL,

  PRIMARY KEY (history_id),

  CONSTRAINT guacamole_user_history_ibfk_1
    FOREIGN KEY (user_id)
    REFERENCES guacamole_user (user_id) ON DELETE SET NULL

);

CREATE INDEX guacamole_user_history_user_id
    ON guacamole_user_history(user_id);

CREATE INDEX guacamole_user_history_start_date
    ON guacamole_user_history(start_date);

CREATE INDEX guacamole_user_history_end_date
    ON guacamole_user_history(end_date);

CREATE INDEX guacamole_user_history_user_id_start_date
    ON guacamole_user_history(user_id, start_date);
