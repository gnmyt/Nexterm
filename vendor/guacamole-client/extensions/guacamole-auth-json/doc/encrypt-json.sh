#!/bin/bash -e
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

##
## @fn encrypt-json.sh 
##
## Encrypts and signs JSON using the provided key, returning base64-encoded
## data ready to be submitted to Guacamole and used by the guacamole-auth-json
## authentication provider. Beware that this base64-encoded must still be
## URL-encoded prior to submission to /api/tokens via POST. Base64 encoding may
## contain + and = characters, which have special meaning in URLs.
##
## To submit the resulting data easily via curl, the following will work:
##
## curl --data-urlencode "data=$(<file_containing_result)" GUAC_URL/api/tokens
##
## @param SECRET_KEY
##     The key to encrypt and sign the JSON file with, as a 16-byte (32-digit)
##     hexadecimal value. This key must match the key specified within
##     guacamole.properties using the "json-secret-key" property.
##
## @param JSON_FILENAME
##     The filename of the JSON to encrypt and sign.
##

##
## Encryption/signing key.
##
SECRET_KEY="$1"

##
## The filename of the JSON data being signed and encrypted.
##
JSON_FILENAME="$2"

##
## A null (all zeroes) IV.
##
NULL_IV="00000000000000000000000000000000"

##
## Signs the contents of the given file using the given key. The signature is
## created using HMAC/SHA-256, and is output in binary form to STDOUT, followed
## by the raw contents of the file.
##
## @param KEY
##     The key to use to sign the contents of the given file with HMAC/SHA-256.
##
## @param FILENAME
##     The filename of the file to sign.
##
sign() {

    KEY="$1"
    FILENAME="$2"

    #
    # Write out signature
    #

    openssl dgst                                \
        -sha256 -mac HMAC -macopt hexkey:"$KEY" \
        -binary "$FILENAME"

    #
    # Write out file contents
    #

    cat "$FILENAME"

}

##
## Encrypts all data received through STDIN using the provided key. Data is
## encrypted using 128-bit AES in CBC mode (with a null IV). The encrypted
## result is printed to STDOUT encoded with base64.
##
## @param KEY
##     The key to encrypt STDIN with, as a 16-byte (32-digit) hexadecimal
##     value.
##
encrypt() {

    KEY="$1"

    #
    # Encrypt STDIN
    #

    openssl enc -aes-128-cbc -K "$KEY" -iv "$NULL_IV" -nosalt -a

}

#
# Sign and encrypt file using secret key
#

sign "$SECRET_KEY" "$JSON_FILENAME" | encrypt "$SECRET_KEY"

