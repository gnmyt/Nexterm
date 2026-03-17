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

const finder = require('find-package-json');
const fs = require('fs');
const path = require('path');
const validateOptions = require('schema-utils');

/**
 * The name of this plugin.
 *
 * @type {string}
 */
const PLUGIN_NAME = 'dependency-list-plugin';

/**
 * The schema of the configuration options object accepted by the constructor
 * of DependencyListPlugin.
 *
 * @see https://github.com/webpack/schema-utils/blob/v1.0.0/README.md#usage
 */
const PLUGIN_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {

        /**
         * The name of the file that should contain the dependency list. By
         * default, this will be "npm-dependencies.txt".
         */
        filename: { type: 'string' },

        /**
         * The path in which the dependency list file should be saved. By
         * default, this will be the output path of the Webpack compiler.
         */
        path: { type: 'string' }

    },
    additionalProperties: false
};

/**
 * Webpack plugin that automatically lists each of the NPM dependencies
 * included within any bundles produced by the compile process.
 */
class DependencyListPlugin {

    /**
     * Creates a new DependencyListPlugin configured with the given options.
     * The options given must conform to the options schema.
     *
     * @see PLUGIN_OPTIONS_SCHEMA
     *
     * @param {*} options
     *     The configuration options to apply to the plugin.
     */
    constructor(options = {}) {
        validateOptions(PLUGIN_OPTIONS_SCHEMA, options, 'DependencyListPlugin');
        this.options = options;
    }

    /**
     * Entrypoint for all Webpack plugins. This function will be invoked when
     * the plugin is being associated with the compile process.
     *
     * @param {Compiler} compiler
     *     A reference to the Webpack compiler.
     */
    apply(compiler) {

        /**
         * Logger for this plugin.
         *
         * @type {Logger}
         */
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

        /**
         * The directory receiving the dependency list file.
         *
         * @type {string}
         */
        const outputPath = this.options.path || compiler.options.output.path;

        /**
         * The full path to the output file that should contain the list of
         * discovered NPM module dependencies.
         *
         * @type {string}
         */
        const outputFile = path.join(
            outputPath,
            this.options.filename || 'npm-dependencies.txt'
        );

        // Wait for compilation to fully complete
        compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {

            const moduleCoords = {};

            // Map each file used within any bundle built by the compiler to
            // its corresponding NPM package, ignoring files that have no such
            // package
            stats.compilation.fileDependencies.forEach(file => {

                // Locate NPM package corresponding to file dependency (there
                // may not be one)
                const moduleFinder = finder(file);
                const npmPackage = moduleFinder.next().value;

                // Translate absolute path into more readable path relative to
                // root of compilation process
                const relativePath = path.relative(compiler.options.context, file);

                if (npmPackage.name) {
                    moduleCoords[npmPackage.name + ':' + npmPackage.version] = true;
                    logger.info('File dependency "%s" mapped to NPM package "%s" (v%s)',
                        relativePath, npmPackage.name, npmPackage.version);
                }
                else
                    logger.info('Skipping file dependency "%s" (no NPM package)',
                        relativePath);

            });

            // Create output path if it doesn't yet exist
            if (!fs.existsSync(outputPath))
                fs.mkdirSync(outputPath, { recursive: true, mode: 0o755 });

            // Write all discovered NPM packages to configured output file
            const sortedCoords = Object.keys(moduleCoords).sort();
            fs.writeFileSync(outputFile, sortedCoords.join('\n') + '\n');

        });

    }

}

module.exports = DependencyListPlugin;

