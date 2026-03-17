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

/**
 * A karma configuration intended for use in builds or CI. Runs all discovered
 * unit tests under a headless firefox browser and immediately exits.
 */
module.exports = function(config) {
  config.set({

    // Discover and run jasmine tests
    frameworks: ['jasmine'],

    // Pattern matching all javascript source and tests
    files: [
      'src/**/*.js'
    ],

    // Run the tests once and exit
    singleRun: true,

    // Disable automatic test running on changed files
    autoWatch: false,

    // Use a headless firefox browser to run the tests
    browsers: ['FirefoxHeadless'],
    customLaunchers: {
      'FirefoxHeadless': {
        base: 'Firefox',
        flags: [
            '--headless'
        ]
      }
    }

  });
  
};
