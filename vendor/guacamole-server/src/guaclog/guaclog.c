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

#include "config.h"

#include "guaclog.h"
#include "interpret.h"
#include "log.h"

#include <getopt.h>
#include <stdbool.h>
#include <stdio.h>

int main(int argc, char* argv[]) {

    int i;

    /* Load defaults */
    bool force = false;

    /* Parse arguments */
    int opt;
    while ((opt = getopt(argc, argv, "s:r:f")) != -1) {

        /* -f: Force */
        if (opt == 'f')
            force = true;

        /* Invalid option */
        else {
            goto invalid_options;
        }

    }

    /* Log start */
    guaclog_log(GUAC_LOG_INFO, "Guacamole input log interpreter (guaclog) "
            "version " VERSION);

    /* Track number of overall failures */
    int total_files = argc - optind;
    int failures = 0;

    /* Abort if no files given */
    if (total_files <= 0) {
        guaclog_log(GUAC_LOG_INFO, "No input files specified. Nothing to do.");
        return 0;
    }

    guaclog_log(GUAC_LOG_INFO, "%i input file(s) provided.", total_files);

    /* Interpret all input files */
    for (i = optind; i < argc; i++) {

        /* Get current filename */
        const char* path = argv[i];

        /* Generate output filename */
        char out_path[4096];
        int len = snprintf(out_path, sizeof(out_path), "%s.txt", path);

        /* Do not write if filename exceeds maximum length */
        if (len >= sizeof(out_path)) {
            guaclog_log(GUAC_LOG_ERROR, "Cannot write output file for \"%s\": "
                    "Name too long", path);
            continue;
        }

        /* Attempt interpreting, log granular success/failure at debug level */
        if (guaclog_interpret(path, out_path, force)) {
            failures++;
            guaclog_log(GUAC_LOG_DEBUG,
                    "%s was NOT successfully interpreted.", path);
        }
        else
            guaclog_log(GUAC_LOG_DEBUG, "%s was successfully "
                    "interpreted.", path);

    }

    /* Warn if at least one file failed */
    if (failures != 0)
        guaclog_log(GUAC_LOG_WARNING, "Interpreting failed for %i of %i "
                "file(s).", failures, total_files);

    /* Notify of success */
    else
        guaclog_log(GUAC_LOG_INFO, "All files interpreted successfully.");

    /* Interpreting complete */
    return 0;

    /* Display usage and exit with error if options are invalid */
invalid_options:

    fprintf(stderr, "USAGE: %s"
            " [-f]"
            " [FILE]...\n", argv[0]);

    return 1;

}

