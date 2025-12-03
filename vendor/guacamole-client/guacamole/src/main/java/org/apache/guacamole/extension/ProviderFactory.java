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
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 */

package org.apache.guacamole.extension;

import org.apache.guacamole.GuacamoleException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.InvocationTargetException;

/**
 * A utility for creating provider instances and logging unexpected outcomes
 * with sufficient detail to allow debugging.
 */
class ProviderFactory {

    /**
     * Logger used to log unexpected outcomes.
     */
    private static final Logger logger = LoggerFactory.getLogger(ProviderFactory.class);

    /**
     * Creates an instance of the specified provider class using the no-arg constructor.
     *
     * @param typeName
     *      The provider type name used for log messages; e.g. "authentication provider".
     *
     * @param providerClass
     *      The provider class to instantiate.
     *
     * @param <T>
     *      The provider type.
     *
     * @return
     *      A provider instance or null if no instance was created due to error.
     */
    static <T> T newInstance(String typeName, Class<? extends T> providerClass) {
        T instance = null;

        try {
            // Attempt to instantiate the provider
            instance = providerClass.getConstructor().newInstance();
        }
        catch (NoSuchMethodException e) {
            logger.error("The {} extension in use is not properly defined. "
                    + "Please contact the developers of the extension or, if you "
                    + "are the developer, turn on debug-level logging.", typeName);
            logger.debug("{} is missing a default constructor.",
                    providerClass.getName(), e);
        }
        catch (SecurityException e) {
            logger.error("The Java security manager is preventing extensions "
                    + "from being loaded. Please check the configuration of Java or your "
                    + "servlet container.");
            logger.debug("Creation of {} disallowed by security manager.",
                    providerClass.getName(), e);
        }
        catch (InstantiationException e) {
            logger.error("The {} extension in use is not properly defined. "
                    + "Please contact the developers of the extension or, if you "
                    + "are the developer, turn on debug-level logging.", typeName);
            logger.debug("{} cannot be instantiated.", providerClass.getName(), e);
        }
        catch (IllegalAccessException e) {
            logger.error("The {} extension in use is not properly defined. "
                    + "Please contact the developers of the extension or, if you "
                    + "are the developer, turn on debug-level logging.");
            logger.debug("Default constructor of {} is not public.", typeName, e);
        }
        catch (IllegalArgumentException e) {
            logger.error("The {} extension in use is not properly defined. "
                    + "Please contact the developers of the extension or, if you "
                    + "are the developer, turn on debug-level logging.", typeName);
            logger.debug("Default constructor of {} cannot accept zero arguments.",
                    providerClass.getName(), e);
        }
        catch (InvocationTargetException e) {
            // Obtain causing error - create relatively-informative stub error if cause is unknown
            Throwable cause = e.getCause();
            if (cause == null)
                cause = new GuacamoleException("Error encountered during initialization.");

            logger.error("{} extension failed to start: {}", typeName, cause.getMessage());
            logger.debug("{} instantiation failed.", providerClass.getName(), e);
        }

        return instance;
    }

}
