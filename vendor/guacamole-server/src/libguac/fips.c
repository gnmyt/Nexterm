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
#include "guacamole/fips.h"

/* If OpenSSL is available, include header for version numbers */
#ifdef ENABLE_SSL
    #include <openssl/opensslv.h>

    /* OpenSSL versions prior to 0.9.7e did not have FIPS support */
    #if !defined(OPENSSL_VERSION_NUMBER) || (OPENSSL_VERSION_NUMBER < 0x00090705f)
    #define GUAC_FIPS_ENABLED 0

    /* OpenSSL 3+ uses EVP_default_properties_is_fips_enabled() */
    #elif defined(OPENSSL_VERSION_MAJOR) && (OPENSSL_VERSION_MAJOR >= 3)
    #include <openssl/evp.h>
    #define GUAC_FIPS_ENABLED EVP_default_properties_is_fips_enabled(NULL)

    /* For OpenSSL versions between 0.9.7e and 3.0, use FIPS_mode() */
    #else
    #include <openssl/crypto.h>
    #define GUAC_FIPS_ENABLED FIPS_mode()
    #endif

/* FIPS support does not exist if OpenSSL is not available. */
#else
#define GUAC_FIPS_ENABLED 0
#endif

int guac_fips_enabled() {

    return GUAC_FIPS_ENABLED;

}
