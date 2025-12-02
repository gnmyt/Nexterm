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

package org.apache.guacamole.log;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.joran.JoranConfigurator;
import ch.qos.logback.core.joran.spi.JoranException;
import ch.qos.logback.core.util.StatusPrinter;
import com.google.inject.AbstractModule;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Initializes the logging subsystem.
 */
public class LogModule extends AbstractModule {

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(LogModule.class);

    /**
     * The Guacamole server environment.
     */
    private final Environment environment;

    /**
     * Property that specifies the highest level of verbosity that Guacamole
     * should use for the messages in its logs.
     */
    private static final EnumGuacamoleProperty<LogLevel> LOG_LEVEL = new EnumGuacamoleProperty<LogLevel>(LogLevel.class) {

        @Override
        public String getName() {
            return "log-level";
        }

    };

    /**
     * Creates a new LogModule which uses the given environment to determine
     * the logging configuration.
     *
     * @param environment
     *     The environment to use when configuring logging.
     */
    public LogModule(Environment environment) {
        this.environment = environment;
    }

    /**
     * Returns an InputStream that streams the contents of the "logback.xml"
     * file that Logback should read to configure logging to Guacamole. If the
     * user provided their own "logback.xml" within GUACAMOLE_HOME, this will
     * be an InputStream that reads the contents of that file. The required
     * "logback.xml" will otherwise be dynamically generated based on the value
     * of the "log-level" property.
     *
     * @return
     *     An InputStream that streams the contents of the "logback.xml" file
     *     that Logback should read to configure logging to Guacamole.
     */
    private InputStream getLogbackConfiguration() {

        // Check for custom logback.xml
        File logbackFile = new File(environment.getGuacamoleHome(), "logback.xml");
        if (logbackFile.exists()) {
            try {
                logger.info("Loading logback configuration from \"{}\".", logbackFile);
                return new FileInputStream(logbackFile);
            }
            catch (FileNotFoundException e) {
                logger.info("Logback configuration could not be read "
                        + "from \"{}\": {}", logbackFile, e.getMessage());
            }
        }

        // Default to generating an internal logback.xml based on a simple
        // "log-level" property
        LogLevel level;
        try {
            level = environment.getProperty(LOG_LEVEL, LogLevel.INFO);
            logger.info("Logging will be at the \"{}\" level.", level.getCanonicalName());
        }
        catch (GuacamoleException e) {
            level = LogLevel.INFO;
            logger.error("Falling back to \"{}\" log level: {}", level.getCanonicalName(), e.getMessage());
        }

        return level.getLogbackConfiguration();

    }

    @Override
    protected void configure() {

        try (InputStream logbackConfiguration = getLogbackConfiguration()) {

            LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
            context.reset();

            // Initialize logback
            JoranConfigurator configurator = new JoranConfigurator();
            configurator.setContext(context);
            configurator.doConfigure(logbackConfiguration);

            // Dump any errors that occur during logback init
            StatusPrinter.printInCaseOfErrorsOrWarnings(context);

        }
        catch (JoranException e) {
            logger.error("Initialization of logback failed: {}", e.getMessage());
            logger.debug("Unable to load logback configuration.", e);
        }
        catch (IOException e) {
            logger.warn("Logback configuration file could not be cleanly closed: {}", e.getMessage());
            logger.debug("Failed to close logback configuration file.", e);
        }

    }

}
