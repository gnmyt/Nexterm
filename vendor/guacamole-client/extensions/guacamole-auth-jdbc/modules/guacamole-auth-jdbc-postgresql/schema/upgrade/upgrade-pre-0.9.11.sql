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
-- Add per-user password set date
--

ALTER TABLE guacamole_user
    ADD COLUMN password_date timestamptz;

UPDATE guacamole_user SET password_date = CURRENT_TIMESTAMP;

ALTER TABLE guacamole_user
    ALTER COLUMN password_date SET NOT NULL;

--
-- User password history
--

CREATE TABLE guacamole_user_password_history (

  password_history_id serial  NOT NULL,
  user_id             integer NOT NULL,

  -- Salted password
  password_hash bytea        NOT NULL,
  password_salt bytea,
  password_date timestamptz  NOT NULL,

  PRIMARY KEY (password_history_id),

  CONSTRAINT guacamole_user_password_history_ibfk_1
    FOREIGN KEY (user_id)
    REFERENCES guacamole_user (user_id) ON DELETE CASCADE

);

CREATE INDEX guacamole_user_password_history_user_id
    ON guacamole_user_password_history(user_id);
