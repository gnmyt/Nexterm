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

#ifndef GUAC_KUBERNETES_URL_H
#define GUAC_KUBERNETES_URL_H

/**
 * The maximum number of characters allowed in the full path for any Kubernetes
 * endpoint.
 */
#define GUAC_KUBERNETES_MAX_ENDPOINT_LENGTH 1024

/**
 * Escapes the given string such that it can be included safely within a URL.
 * This function duplicates the behavior of JavaScript's encodeURIComponent(),
 * escaping all but the following characters: A-Z a-z 0-9 - _ . ! ~ * ' ( )
 *
 * @param output
 *     The buffer which should receive the escaped string. This buffer may be
 *     touched even if escaping is unsuccessful.
 *
 * @param length
 *     The number of bytes available in the given output buffer.
 *
 * @param str
 *     The string to escape.
 *
 * @return
 *     Zero if the string was successfully escaped and written into the
 *     provided output buffer without being truncated, including null
 *     terminator, non-zero otherwise.
 */
int guac_kubernetes_escape_url_component(char* output, int length,
        const char* str);

/**
 * Appends the given query parameter and value to the given buffer. If the
 * buffer does not already contain the '?' character denoting the start of the
 * query string, it will be added. If the buffer already contains a query
 * string, a '&' character will be added before the new parameter. The
 * parameter value will automatically be URL-escaped as necessary.
 *
 * @param buffer
 *     The buffer which should receive the parameter. It could contain the endpoint path.
 *     The parameter will be written to the end of the buffer.
 *
 * @param length
 *     The number of bytes available in the given buffer.
 *
 * @param param_name
 *     The name of the parameter. If the parameter name contains characters
 *     with special meaning to URLs, it must already be URL-escaped.
 *
 * @param param_value
 *     The value of the parameter.
 *
 * @return
 *     Zero if the parameter was successfully attached to the buffer,
 *     non-zero if insufficient space exists within the buffer or
 *     buffer not null terminated.
 */
int guac_kubernetes_append_endpoint_param(char* buffer, int length,
        const char* param_name, const char* param_value);

/**
 * Generates the full path to the Kubernetes API endpoint which handles
 * attaching to running containers within specific pods. Values within the path
 * will be URL-escaped as necessary.
 *
 * @param buffer
 *     The buffer which should receive the endpoint path. This buffer may be
 *     touched even if the endpoint path could not be generated.
 *
 * @param length
 *     The number of bytes available in the given buffer.
 *
 * @param kubernetes_namespace
 *     The name of the Kubernetes namespace of the pod containing the container
 *     being attached to.
 *
 * @param kubernetes_pod
 *     The name of the Kubernetes pod containing with the container being
 *     attached to.
 *
 * @param kubernetes_container
 *     The name of the container to attach to, or NULL to arbitrarily attach
 *     to the first container in the pod.
 *  
 * @param exec_command
 *     The command used to run a new process and attach to it,
 *     instead of the main container process.
 *
 * @return
 *     Zero if the endpoint path was successfully written to the provided
 *     buffer, non-zero if insufficient space exists within the buffer.
 */
int guac_kubernetes_endpoint_uri(char* buffer, int length,
        const char* kubernetes_namespace, const char* kubernetes_pod,
        const char* kubernetes_container, const char* exec_command);

#endif

