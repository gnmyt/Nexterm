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

#include "kubernetes.h"
#include "settings.h"

#include <guacamole/client.h>
#include <openssl/asn1.h>
#include <openssl/bio.h>
#include <openssl/pem.h>
#include <openssl/ssl.h>
#include <openssl/x509v3.h>
#include <openssl/x509_vfy.h>

/**
 * Tests whether the given hostname is, in fact, an IP address.
 *
 * @param hostname
 *     The hostname to test.
 *
 * @return
 *     Non-zero if the given hostname is an IP address, zero otherwise.
 */
static int guac_kubernetes_is_address(const char* hostname) {

    /* Attempt to interpret the hostname as an IP address */
    ASN1_OCTET_STRING* ip = a2i_IPADDRESS(hostname);

    /* If unsuccessful, the hostname is not an IP address */
    if (ip == NULL)
        return 0;

    /* Converted hostname must be freed */
    ASN1_OCTET_STRING_free(ip);
    return 1;

}

/**
 * Parses the given PEM certificate, returning a new OpenSSL X509 structure
 * representing that certificate.
 *
 * @param pem
 *     The PEM certificate.
 *
 * @return
 *     An X509 structure representing the given certificate, or NULL if the
 *     certificate was unreadable.
 */
static X509* guac_kubernetes_read_cert(char* pem) {

    /* Prepare a BIO which provides access to the in-memory CA cert */
    BIO* bio = BIO_new_mem_buf(pem, -1);
    if (bio == NULL)
        return NULL;

    /* Read the CA cert as PEM */
    X509* certificate = PEM_read_bio_X509(bio, NULL, NULL, NULL);
    if (certificate == NULL) {
        BIO_free(bio);
        return NULL;
    }

    return certificate;

}

/**
 * Parses the given PEM private key, returning a new OpenSSL EVP_PKEY structure
 * representing that key.
 *
 * @param pem
 *     The PEM private key.
 *
 * @return
 *     An EVP_KEY representing the given private key, or NULL if the private
 *     key was unreadable.
 */
static EVP_PKEY* guac_kubernetes_read_key(char* pem) {

    /* Prepare a BIO which provides access to the in-memory key */
    BIO* bio = BIO_new_mem_buf(pem, -1);
    if (bio == NULL)
        return NULL;

    /* Read the private key as PEM */
    EVP_PKEY* key = PEM_read_bio_PrivateKey(bio, NULL, NULL, NULL);
    if (key == NULL) {
        BIO_free(bio);
        return NULL;
    }

    return key;

}

/**
 * OpenSSL certificate verification callback which universally accepts all
 * certificates without performing any verification at all.
 *
 * @param x509_ctx
 *     The current context of the certificate verification process. This
 *     parameter is ignored by this particular implementation of the callback.
 *
 * @param arg
 *     The arbitrary value passed to SSL_CTX_set_cert_verify_callback(). This
 *     parameter is ignored by this particular implementation of the callback.
 *
 * @return
 *     Strictly 0 if certificate verification fails, 1 if the certificate is
 *     verified. No other values are legal return values for this callback as
 *     documented by OpenSSL.
 */
static int guac_kubernetes_assume_cert_ok(X509_STORE_CTX* x509_ctx, void* arg) {
    return 1;
}

void guac_kubernetes_init_ssl(guac_client* client, SSL_CTX* context) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    guac_kubernetes_settings* settings = kubernetes_client->settings;

    /* Bypass certificate checks if requested */
    if (settings->ignore_cert) {
        SSL_CTX_set_verify(context, SSL_VERIFY_PEER, NULL);
        SSL_CTX_set_cert_verify_callback(context,
                guac_kubernetes_assume_cert_ok, NULL);
    }

    /* Otherwise use the given CA certificate to validate (if any) */
    else if (settings->ca_cert != NULL) {

        /* Read CA certificate from configuration data */
        X509* ca_cert = guac_kubernetes_read_cert(settings->ca_cert);
        if (ca_cert == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Provided CA certificate is unreadable");
            return;
        }

        /* Add certificate to CA store */
        X509_STORE* ca_store = SSL_CTX_get_cert_store(context);
        if (!X509_STORE_add_cert(ca_store, ca_cert)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Unable to add CA certificate to certificate store of "
                    "SSL context");
            return;
        }

    }

    /* Certificate for SSL/TLS client auth */
    if (settings->client_cert != NULL) {

        /* Read client certificate from configuration data */
        X509* client_cert = guac_kubernetes_read_cert(settings->client_cert);
        if (client_cert == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Provided client certificate is unreadable");
            return;
        }

        /* Use parsed certificate for authentication */
        if (!SSL_CTX_use_certificate(context, client_cert)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Client certificate could not be used for SSL/TLS "
                    "client authentication");
            return;
        }

    }

    /* Private key for SSL/TLS client auth */
    if (settings->client_key != NULL) {

        /* Read client private key from configuration data */
        EVP_PKEY* client_key = guac_kubernetes_read_key(settings->client_key);
        if (client_key == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Provided client private key is unreadable");
            return;
        }

        /* Use parsed key for authentication */
        if (!SSL_CTX_use_PrivateKey(context, client_key)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Client private key could not be used for SSL/TLS "
                    "client authentication");
            return;
        }

    }

    /* Enable hostname checking */
    X509_VERIFY_PARAM *param = SSL_CTX_get0_param(context);
    X509_VERIFY_PARAM_set_hostflags(param,
            X509_CHECK_FLAG_NO_PARTIAL_WILDCARDS);

    /* Validate properly depending on whether hostname is an IP address */
    if (guac_kubernetes_is_address(settings->hostname)) {
        if (!X509_VERIFY_PARAM_set1_ip_asc(param, settings->hostname)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Server IP address validation could not be enabled");
            return;
        }
    }
    else {
        if (!X509_VERIFY_PARAM_set1_host(param, settings->hostname, 0)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Server hostname validation could not be enabled");
            return;
        }
    }

}

