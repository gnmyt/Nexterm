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

package org.apache.guacamole.auth.sqlserver.conf;

import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * The possible SQL Server drivers to use when using a TDS-compatible database.
 */
public enum SQLServerDriver {

    /**
     * The open source jTDS driver.
     */
    @PropertyValue("jtds")
    JTDS,

    /**
     * The Progress DataDirect driver.
     */
    @PropertyValue("datadirect")
    DATA_DIRECT,

    /**
     * The Microsoft Legacy SQL Server driver.
     */
    @PropertyValue("microsoft")
    MICROSOFT_LEGACY,

    /**
     * The Microsoft 2005 SQL Server driver.
     */
    @PropertyValue("microsoft2005")
    MICROSOFT_2005;
}
