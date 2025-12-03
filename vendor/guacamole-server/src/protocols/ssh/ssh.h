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

#ifndef GUAC_SSH_H
#define GUAC_SSH_H

#include "config.h"

#include "common/clipboard.h"
#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"
#include "common-ssh/user.h"
#include "settings.h"
#include "terminal/terminal.h"

#ifdef ENABLE_SSH_AGENT
#include "ssh_agent.h"
#endif

#include <guacamole/client.h>
#include <guacamole/recording.h>

#include <pthread.h>

/**
 * SSH-specific client data.
 */
typedef struct guac_ssh_client {

    /**
     * SSH connection settings.
     */
    guac_ssh_settings* settings;

#ifdef ENABLE_SSH_AGENT
    /**
     * The current agent, if any.
     */
    ssh_auth_agent* auth_agent;
#endif

    /**
     * The SSH client thread.
     */
    pthread_t client_thread;

    /**
     * The user and credentials to use for all SSH sessions.
     */
    guac_common_ssh_user* user;

    /**
     * SSH session, used by the SSH client thread.
     */
    guac_common_ssh_session* session;

    /**
     * SFTP session, used by the SFTP client/filesystem.
     */
    guac_common_ssh_session* sftp_session;

    /**
     * The filesystem object exposed for the SFTP session.
     */
    guac_common_ssh_sftp_filesystem* sftp_filesystem;

    /**
     * SSH terminal channel, used by the SSH client thread.
     */
    LIBSSH2_CHANNEL* term_channel;

    /**
     * Lock dictating access to the SSH terminal channel.
     */
    pthread_mutex_t term_channel_lock;

    /**
     * The terminal which will render all output from the SSH client.
     */
    guac_terminal* term;
   
    /**
     * The in-progress session recording, or NULL if no recording is in
     * progress.
     */
    guac_recording* recording;

} guac_ssh_client ;

/**
 * Main SSH client thread, handling transfer of SSH output to STDOUT.
 *
 * @param data
 *     The guac_client to associate with a new SSH session, once the SSH
 *     connection succeeds.
 *
 * @return
 *     NULL in all cases. The return value of this thread is expected to be
 *     ignored.
 */
void* ssh_client_thread(void* data);

#endif

