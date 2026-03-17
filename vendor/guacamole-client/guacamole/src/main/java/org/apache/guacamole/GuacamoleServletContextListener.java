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

package org.apache.guacamole;

import com.google.common.collect.Lists;
import org.apache.guacamole.tunnel.TunnelModule;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Stage;
import com.google.inject.servlet.GuiceServletContextListener;
import java.io.File;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import javax.inject.Inject;
import javax.servlet.ServletContextEvent;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.extension.ExtensionModule;
import org.apache.guacamole.log.LogModule;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.event.ApplicationShutdownEvent;
import org.apache.guacamole.net.event.ApplicationStartedEvent;
import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.FileGuacamoleProperties;
import org.apache.guacamole.rest.RESTServiceModule;
import org.apache.guacamole.rest.auth.HashTokenSessionMap;
import org.apache.guacamole.rest.auth.TokenSessionMap;
import org.apache.guacamole.rest.event.ListenerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A ServletContextListener to listen for initialization of the servlet context
 * in order to set up dependency injection.
 *
 * NOTE: Guacamole's REST API uses Jersey 2.x which does not natively support
 * dependency injection using Guice. It DOES support dependency injection using
 * HK2, which supports bi-directional bridging with Guice.
 *
 * The overall process is thus:
 *
 * 1. Application initialization proceeds using GuacamoleServletContextListener,
 *    a subclass of GuiceServletContextListener, with all HTTP requests being
 *    routed through GuiceFilter which serves as the absolute root.
 *
 * 2. GuacamoleServletContextListener prepares the Guice injector, storing the
 *    injector within the ServletContext such that it can later be bridged with
 *    HK2.
 *
 * 3. Several of the modules used to prepare the Guice injector are
 *    ServletModule subclasses, which define HTTP request paths that GuiceFilter
 *    should route to specific servlets. One of these paths is "/api/*" (the
 *    root of the REST API) which is routed to Jersey's ServletContainer servlet
 *    (the root of Jersey's JAX-RS implementation).
 *
 * 4. Configuration information passed to Jersey's ServletContainer tells Jersey
 *    to use the GuacamoleApplication class (a subclass of ResourceConfig) to
 *    define the rest of the resources and any other configuration.
 *
 * 5. When Jersey creates its instance of GuacamoleApplication, the
 *    initialization process of GuacamoleApplication pulls the Guice injector
 *    from the ServletContext, completes the HK2 bridging, and configures Jersey
 *    to automatically locate and inject all REST services.
 */
public class GuacamoleServletContextListener extends GuiceServletContextListener {

    /**
     * The name of the ServletContext attribute which will contain a reference
     * to the Guice injector once the contextInitialized() event has been
     * handled.
     */
    public static final String GUICE_INJECTOR = "GUAC_GUICE_INJECTOR";

    /**
     * Logger for this class.
     */
    private final Logger logger = LoggerFactory.getLogger(GuacamoleServletContextListener.class);

    /**
     * A property that determines whether environment variables are evaluated
     * to supply properties not specified in guacamole.properties.
     */
    private static final BooleanGuacamoleProperty ENABLE_ENVIRONMENT_PROPERTIES =
        new BooleanGuacamoleProperty() {
            @Override
            public String getName() {
                return "enable-environment-properties";
            }
        };

    /**
     * A property that determines whether environment variables of the form
     * "*_FILE" are evaluated to supply properties not specified in
     * guacamole.properties nor in environment variables.
     */
    private static final BooleanGuacamoleProperty ENABLE_FILE_ENVIRONMENT_PROPERTIES =
        new BooleanGuacamoleProperty() {
            @Override
            public String getName() {
                return "enable-file-environment-properties";
            }
        };

    /**
     * The Guacamole server environment.
     */
    private Environment environment;

    /**
     * Singleton instance of a TokenSessionMap.
     */
    private TokenSessionMap sessionMap;

    /**
     * List of all authentication providers from all loaded extensions.
     */
    @Inject
    private List<AuthenticationProvider> authProviders;

    /**
     * All temporary files that should be deleted upon application shutdown, in
     * reverse order of desired deletion. This will typically simply be the
     * order that each file was created.
     */
    @Inject
    private List<File> temporaryFiles;

    /**
     * Service for dispatching events to registered listeners.
     */
    @Inject
    private ListenerService listenerService;

    /**
     * Internal reference to the Guice injector that was lazily created when
     * getInjector() was first invoked.
     */
    private final AtomicReference<Injector> guiceInjector = new AtomicReference<>();

    @Override
    public void contextInitialized(ServletContextEvent servletContextEvent) {

        environment = LocalEnvironment.getInstance();

        // Read configuration information from GUACAMOLE_HOME/guacamole.properties
        try {
            File guacProperties = new File(environment.getGuacamoleHome(), "guacamole.properties");
            environment.addGuacamoleProperties(new FileGuacamoleProperties(guacProperties));
            logger.info("Read configuration parameters from \"{}\".", guacProperties);
        }
        catch (GuacamoleException e) {
            logger.error("Unable to read guacamole.properties: {}", e.getMessage());
            logger.debug("Error reading guacamole.properties.", e);
        }

        // For any values not defined in GUACAMOLE_HOME/guacamole.properties,
        // read from system environment if "enable-environment-properties" is
        // set to "true"
        try {
            if (environment.getProperty(ENABLE_ENVIRONMENT_PROPERTIES, false)) {
                environment.addGuacamoleProperties(new SystemEnvironmentGuacamoleProperties());
                logger.info("Additional configuration parameters may be read "
                        + "from environment variables.");
            }
        }
        catch (GuacamoleException e) {
            logger.error("Unable to configure support for environment properties: {}", e.getMessage());
            logger.debug("Error reading \"{}\" property from guacamole.properties.", ENABLE_ENVIRONMENT_PROPERTIES.getName(), e);
        }

        // For any values not defined in GUACAMOLE_HOME/guacamole.properties
        // nor in the system environment, read from files pointed to by
        // corresponding "*_FILE" variables in the system environment if
        // "enable-file-environment-properties" is set to "true"
        try {
            if (environment.getProperty(ENABLE_FILE_ENVIRONMENT_PROPERTIES, false)) {
                environment.addGuacamoleProperties(new SystemFileEnvironmentGuacamoleProperties());
                logger.info("Additional configuration parameters may be read "
                        + "from files pointed to by \"*_FILE\" environment "
                        + "variables.");
            }
        }
        catch (GuacamoleException e) {
            logger.error("Unable to configure support for file environment properties: {}", e.getMessage());
            logger.debug("Error reading \"{}\" property from guacamole.properties.", ENABLE_FILE_ENVIRONMENT_PROPERTIES.getName(), e);
        }

        // Now that at least the main guacamole.properties source of
        // configuration information is available, initialize the session map
        sessionMap = new HashTokenSessionMap(environment);

        // NOTE: The superclass implementation of contextInitialized() is
        // expected to invoke getInjector(), hence the need to call AFTER
        // setting up the environment and session map
        super.contextInitialized(servletContextEvent);

        // Inject any annotated members of this class
        Injector injector = getInjector();
        injector.injectMembers(this);

        // Store reference to injector for use by Jersey and HK2 bridge
        servletContextEvent.getServletContext().setAttribute(GUICE_INJECTOR, injector);

        // Inform any listeners that application startup has completed
        try {
            listenerService.handleEvent(new ApplicationStartedEvent() {
                // The application startup event currently has no content
            });
        }
        catch (GuacamoleException e) {
            logger.error("An extension listening for application startup failed: {}", e.getMessage());
            logger.debug("Extension failed internally while handling the application startup event.", e);
        }

    }

    @Override
    protected Injector getInjector() {
        return guiceInjector.updateAndGet((current) -> {

            // Use existing injector if already created
            if (current != null)
                return current;

            // Create new injector if necessary
            Injector injector =

                    // Ensure environment and logging are configured FIRST ...
                    Guice.createInjector(Stage.PRODUCTION,
                        new EnvironmentModule(environment),
                        new LogModule(environment)
                    )

                    // ... before attempting configuration of any other modules
                    // (logging within the constructors of other modules may
                    // otherwise default to including messages from the "debug"
                    // level, regardless of how the application log level is
                    // actually configured)
                    .createChildInjector(
                        new ExtensionModule(environment),
                        new RESTServiceModule(sessionMap),
                        new TunnelModule()
                    );

            return injector;

        });
    }

    /**
     * Deletes the given temporary file/directory, if possible. If the deletion
     * operation fails, a warning is logged noting the failure. If the given
     * file is a directory, it will only be deleted if empty.
     *
     * @param temp
     *     The temporary file to delete.
     */
    private void deleteTemporaryFile(File temp) {
        if (!temp.delete()) {
            logger.warn("Temporary file/directory \"{}\" could not be "
                    + "deleted. The file may remain until the JVM exits, or "
                    + "may need to be manually deleted.", temp);
        }
        else
            logger.debug("Deleted temporary file/directory \"{}\".", temp);
    }
    
    @Override
    public void contextDestroyed(ServletContextEvent servletContextEvent) {
        try {
        
            // Clean up reference to Guice injector
            servletContextEvent.getServletContext().removeAttribute(GUICE_INJECTOR);

            // Shutdown TokenSessionMap, invalidating all sessions (logging all
            // users out)
            if (sessionMap != null)
                sessionMap.shutdown();

            // Unload authentication for all extensions
            if (authProviders != null) {
                for (AuthenticationProvider authProvider : authProviders)
                    authProvider.shutdown();
            }

            // Inform any listeners that application shutdown has completed
            try {
                listenerService.handleEvent(new ApplicationShutdownEvent() {
                    // The application shutdown event currently has no content
                });
            }
            catch (GuacamoleException e) {
                logger.error("An extension listening for application shutdown failed: {}", e.getMessage());
                logger.debug("Extension failed internally while handling the application shutdown event.", e);
            }

        }
        finally {

            // NOTE: This temporary file cleanup must happen AFTER firing the
            // ApplicationShutdownEvent, or an extension that relies on a .jar
            // file among those temporary files might fail internally when
            // attempting to process the event.

            // Regardless of what may succeed/fail here, always attempt to
            // clean up ALL temporary files
            if (temporaryFiles != null)
                Lists.reverse(temporaryFiles).stream().forEachOrdered(this::deleteTemporaryFile);

        }

        // Continue any Guice-specific cleanup
        super.contextDestroyed(servletContextEvent);

    }

}
