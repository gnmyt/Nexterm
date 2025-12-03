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

require('angular-module-shim.js');
require('relocateParameters.js');

require('angular-translate-interpolation-messageformat');
require('angular-translate-loader-static-files');

/**
 * The module for the root of the application.
 */
angular.module('index', [

    require('angular-route'),
    require('angular-translate'),

    'auth',
    'client',
    'clipboard',
    'home',
    'import',
    'login',
    'manage',
    'navigation',
    'notification',
    'rest',
    'settings',

    'templates-main'

]);

// Recursively pull in all other JavaScript and CSS files as requirements (just
// like old minify-maven-plugin build)
const context = require.context('../', true, /.*\.(css|js)$/);
context.keys().forEach(key => context(key));

