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

const AngularTemplateCacheWebpackPlugin = require('angular-templatecache-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ClosureWebpackPlugin = require('closure-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const DependencyListPlugin = require('./plugins/dependency-list-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = {

    bail: true,
    mode: 'production',
    stats: 'minimal',

    output: {
        path: __dirname + '/dist',
        filename: 'guacamole.[contenthash].js',
    },

    // Generate source maps
    devtool: 'source-map',

    // Entry point for the Guacamole webapp is the "index" AngularJS module
    entry: './src/app/index/indexModule.js',

    module: {
        rules: [

            // NOTE: This is required in order to parse ES2020 language features,
            // like the optional chaining and nullish coalescing operators. It
            // specifically needs to operate on the node-modules directory since
            // Webpack 4 cannot handle such language features.
            {
                test: /\.js$/i,
                use: {
                    loader: 'babel-loader',
                    options: {
                      presets: [
                        ['@babel/preset-env']
                      ]
                    }
                }
            },

            // Automatically extract imported CSS for later reference within separate CSS file
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            import: false,
                            url: false
                        }
                    }
                ]
            },

            /*
             * Necessary to be able to use angular 1 with webpack as explained in https://github.com/webpack/webpack/issues/2049
             */
            {
                test: require.resolve('angular'),
                loader: 'exports-loader',
                options: {
                    type: 'commonjs',
                    exports: 'single window.angular'
                }
            }

        ]
    },
    optimization: {
        minimizer: [

            // Minify using Google Closure Compiler
            new ClosureWebpackPlugin({ mode: 'STANDARD' }, {
                languageIn: 'ECMASCRIPT_2020',
                languageOut: 'ECMASCRIPT5',
                compilationLevel: 'SIMPLE'
            }),

            new CssMinimizerPlugin()

        ],
        splitChunks: {
            cacheGroups: {

                // Bundle CSS as one file
                styles: {
                    name: 'styles',
                    test: /\.css$/,
                    chunks: 'all',
                    enforce: true
                }

            }
        }
    },
    plugins: [

        new AngularTemplateCacheWebpackPlugin({
            module: 'templates-main',
            root: 'app/',
            source: 'src/app/**/*.html',
            standalone: true
        }),

        // Automatically clean out dist/ directory
        new CleanWebpackPlugin(),

        // Copy static files to dist/
        new CopyPlugin([
            { from: 'app/**/*' },
            { from: 'fonts/**/*' },
            { from: 'images/**/*' },
            { from: 'layouts/**/*' },
            { from: 'translations/**/*' },
            { from: 'verifyCachedVersion.js' }
        ], {
            context: 'src/'
        }),

        // Copy core libraries for global inclusion
        new CopyPlugin([
            { from: 'angular/angular.min.js' },
            { from: 'blob-polyfill/Blob.js' },
            { from: 'datalist-polyfill/datalist-polyfill.min.js' },
            { from: 'jquery/dist/jquery.min.js' },
            { from: 'lodash/lodash.min.js' }
        ], {
            context: 'node_modules/'
        }),

        // Generate index.html from template
        new HtmlWebpackPlugin({
            inject: false,
            template: 'src/index.html'
        }),

        // Extract CSS from Webpack bundle as separate file
        new MiniCssExtractPlugin({
            filename: 'guacamole.[contenthash].css',
            chunkFilename: '[id].guacamole.[contenthash].css'
        }),

        // List all bundled node modules for sake of automatic LICENSE file
        // generation / sanity checks
        new DependencyListPlugin(),

        // Automatically require used modules
        new webpack.ProvidePlugin({
            jstz: 'jstz',
            Pickr: '@simonwep/pickr',
            saveAs: 'file-saver'
        })

    ],
    resolve: {

        // Include Node modules and base source tree within search path for
        // import/resolve
        modules: [
            'src',
            'node_modules'
        ]

    }

};

