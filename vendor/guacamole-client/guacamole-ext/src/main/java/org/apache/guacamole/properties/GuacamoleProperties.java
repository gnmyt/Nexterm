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

package org.apache.guacamole.properties;

import java.util.Properties;
import org.apache.guacamole.GuacamoleException;

/**
 * An arbitrary set of Guacamole configuration property name/value pairs. This
 * interface is similar in concept to {@link Properties} except that
 * implementations are not required to allow properties to be enumerated or
 * iterated. Properties may simply be retrieved by their names, if known.
 */
public interface GuacamoleProperties {

    /**
     * Returns the value of the property having the given name, if defined. If
     * no such property exists, null is returned.
     *
     * @param name
     *     The name of the property to retrieve.
     *
     * @return
     *     The value of the given property, or null if no such property is
     *     defined.
     *
     * @throws GuacamoleException
     *     If an error prevents the given property from being read.
     */
    String getProperty(String name) throws GuacamoleException;

}
