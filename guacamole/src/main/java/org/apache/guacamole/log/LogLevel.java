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

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.apache.guacamole.properties.EnumGuacamoleProperty.PropertyValue;

/**
 * All log levels supported by the Apache Guacamole web application. Each log
 * level describes a different level of verbosity for the log messages included
 * in web application logs.
 */
public enum LogLevel {

    /**
     * Errors that are fatal in the context of the operation being logged.
     */
    @PropertyValue("error")
    ERROR("error"),

    /**
     * Non-fatal conditions that may indicate the presence of a problem.
     */
    @PropertyValue("warning")
    @PropertyValue("warn")
    WARNING("warning"),

    /**
     * Informational messages of general interest to users or administrators.
     */
    @PropertyValue("info")
    INFO("info"),

    /**
     * Informational messages that are useful for debugging, but are generally
     * not useful to users or administrators. It is expected that debug-level
     * messages, while verbose, will not affect performance.
     */
    @PropertyValue("debug")
    DEBUG("debug"),

    /**
     * Informational messages that may be useful for debugging, but which are
     * so low-level that they may affect performance.
     */
    @PropertyValue("trace")
    TRACE("trace");

    /**
     * Format string whose sole format argument is a String containing the
     * name of the log level. As this configuration will be fed to Logback, the
     * name used must be a name acceptable by Logback.
     */
    private static final String LOGBACK_XML_TEMPLATE =
              "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<configuration>\n"
            + "\n"
            + "    <!-- Default appender -->\n"
            + "    <appender name=\"GUAC-DEFAULT\" class=\"ch.qos.logback.core.ConsoleAppender\">\n"
            + "        <encoder>\n"
            + "            <pattern>%%d{HH:mm:ss.SSS} [%%thread] %%-5level %%logger{36} - %%msg%%n</pattern>\n"
            + "        </encoder>\n"
            + "    </appender>\n"
            + "\n"
            + "    <!-- Log at level defined with \"log-level\" property -->\n"
            + "    <root level=\"%s\">\n"
            + "        <appender-ref ref=\"GUAC-DEFAULT\" />\n"
            + "    </root>\n"
            + "\n"
            + "</configuration>\n";

    /**
     * The name that should be used to refer to this log level in the context
     * of configuring Guacamole. This name should be both descriptive and
     * acceptable as the value of the "log-level" property.
     */
    private final String canonicalName;

    /**
     * The raw contents of the "logback.xml" that configures Logback to log
     * messages at this level, encoded as UTF-8.
     */
    private final byte[] logbackConfig;

    /**
     * Creates a new LogLevel with the given names. The pair of names provided
     * correspond to the name used within Guacamole's configuration and the
     * name used within Logback's configuration.
     *
     * @param canonicalName
     *     The name that should be used for this log level when configuring
     *     Guacamole to log at this level using the "log-level" property.
     *
     * @param logbackLogLevel
     *     The name that would be provided to Logback to log at this level if
     *     manually configuring Logback using "logback.xml".
     */
    private LogLevel(String canonicalName, String logbackLogLevel) {
        this.canonicalName = canonicalName;
        this.logbackConfig = String.format(LOGBACK_XML_TEMPLATE, logbackLogLevel).getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Creates a new LogLevel with the given name. The provided name corresponds
     * to both the name used within Guacamole's configuration and the name used
     * within Logback's configuration.
     *
     * @param logLevel
     *     The name that should be used for this log level when configuring
     *     Guacamole to log at this level using the "log-level" property AND
     *     when manually configuring Logback to log at this level using a
     *     "logback.xml" configuration file.
     */
    private LogLevel(String logLevel) {
        this(logLevel, logLevel);
    }

    /**
     * Returns a name that may be used to refer to this log level when
     * configuring Guacamole using the "log-level" property.
     *
     * @return
     *     A name that may be used to refer to this log level when
     *     configuring Guacamole using the "log-level" property.
     */
    public String getCanonicalName() {
        return canonicalName;
    }

    /**
     * Returns a new InputStream that streams the contents of an XML
     * configuration file that can be provided to Logback to configure logging
     * at this log level.
     *
     * @return
     *     A a new InputStream that streams the contents of an XML
     *     configuration file that can be provided to Logback to configure
     *     logging at this log level.
     */
    public InputStream getLogbackConfiguration() {
        return new ByteArrayInputStream(logbackConfig);
    }

}
