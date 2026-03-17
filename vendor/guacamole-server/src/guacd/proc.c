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

#include "log.h"
#include "move-fd.h"
#include "proc.h"
#include "proc-map.h"

#include <guacamole/client.h>
#include <guacamole/error.h>
#include <guacamole/mem.h>
#include <guacamole/parser.h>
#include <guacamole/plugin.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

#include <errno.h>
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/wait.h>

/**
 * Parameters for the user thread.
 */
typedef struct guacd_user_thread_params {

    /**
     * The process being joined.
     */
    guacd_proc* proc;

    /**
     * The file descriptor of the joining user's socket.
     */
    int fd;

    /**
     * Whether the joining user is the connection owner.
     */
    int owner;

} guacd_user_thread_params;

/**
 * Handles a user's entire connection and socket lifecycle.
 *
 * @param data
 *     A pointer to a guacd_user_thread_params structure describing the user's
 *     associated file descriptor, whether that user is the connection owner
 *     (the first person to join), as well as the process associated with the
 *     connection being joined.
 *
 * @return
 *     Always NULL.
 */
static void* guacd_user_thread(void* data) {

    guacd_user_thread_params* params = (guacd_user_thread_params*) data;
    guacd_proc* proc = params->proc;
    guac_client* client = proc->client;

    /* Get guac_socket for user's file descriptor */
    guac_socket* socket = guac_socket_open(params->fd);
    if (socket == NULL)
        return NULL;

    /* Create skeleton user */
    guac_user* user = guac_user_alloc();
    user->socket = socket;
    user->client = client;
    user->owner  = params->owner;

    /* Handle user connection from handshake until disconnect/completion */
    guac_user_handle_connection(user, GUACD_USEC_TIMEOUT);

    /* Stop client and prevent future users if all users are disconnected */
    if (client->connected_users == 0) {
        guacd_log(GUAC_LOG_INFO, "Last user of connection \"%s\" disconnected", client->connection_id);
        guacd_proc_stop(proc);
    }

    /* Clean up */
    guac_socket_free(socket);
    guac_user_free(user);
    guac_mem_free(params);

    return NULL;

}

/**
 * Begins a new user connection under a given process, using the given file
 * descriptor. The connection will be managed by a separate and detached thread
 * which is started by this function.
 *
 * @param proc
 *     The process that the user is being added to.
 *
 * @param fd
 *     The file descriptor associated with the user's network connection to
 *     guacd.
 *
 * @param owner
 *     Non-zero if the user is the owner of the connection being joined (they
 *     are the first user to join), or zero otherwise.
 */
static void guacd_proc_add_user(guacd_proc* proc, int fd, int owner) {

    guacd_user_thread_params* params = guac_mem_alloc(sizeof(guacd_user_thread_params));
    params->proc = proc;
    params->fd = fd;
    params->owner = owner;

    /* Start user thread */
    pthread_t user_thread;
    pthread_create(&user_thread, NULL, guacd_user_thread, params);
    pthread_detach(user_thread);

}

/**
 * Forcibly kills all processes within the current process group, including the
 * current process and all child processes. This function is only safe to call
 * if the process group ID has been correctly set. Calling this function within
 * a process which does not have a PGID separate from the main guacd process
 * can result in guacd itself being terminated.
 */
static void guacd_kill_current_proc_group() {

    /* Forcibly kill all children within process group */
    if (kill(0, SIGKILL))
        guacd_log(GUAC_LOG_WARNING, "Unable to forcibly terminate "
                "client process: %s ", strerror(errno));

}

/**
 * The current status of a background attempt to free a guac_client instance.
 */
typedef struct guacd_client_free {

    /**
     * The guac_client instance being freed.
     */
    guac_client* client;

    /**
     * The condition which is signalled whenever changes are made to the
     * completed flag. The completed flag only changes from zero (not yet
     * freed) to non-zero (successfully freed).
     */
    pthread_cond_t completed_cond;

    /**
     * Mutex which must be acquired before any changes are made to the
     * completed flag.
     */
    pthread_mutex_t completed_mutex;

    /**
     * Whether the guac_client has been successfully freed. Initially, this
     * will be zero, indicating that the free operation has not yet been
     * attempted. If the client is eventually successfully freed, this will be
     * set to a non-zero value. Changes to this flag are signalled through
     * the completed_cond condition.
     */
    int completed;

} guacd_client_free;

/**
 * Thread which frees a given guac_client instance in the background. If the
 * free operation succeeds, a flag is set on the provided structure, and the
 * change in that flag is signalled with a pthread condition.
 *
 * At the time this function is provided to a pthread_create() call, the
 * completed flag of the associated guacd_client_free structure MUST be
 * initialized to zero, the pthread mutex and condition MUST both be
 * initialized, and the client pointer must point to the guac_client being
 * freed.
 *
 * @param data
 *     A pointer to a guacd_client_free structure describing the free
 *     operation.
 *
 * @return
 *     Always NULL.
 */
static void* guacd_client_free_thread(void* data) {

    guacd_client_free* free_operation = (guacd_client_free*) data;

    /* Attempt to free client (this may never return if the client is
     * malfunctioning) */
    guac_client_free(free_operation->client);

    /* Signal that the client was successfully freed */
    pthread_mutex_lock(&free_operation->completed_mutex);
    free_operation->completed = 1;
    pthread_cond_broadcast(&free_operation->completed_cond);
    pthread_mutex_unlock(&free_operation->completed_mutex);

    return NULL;

}

/**
 * Attempts to free the given guac_client, restricting the time taken by the
 * free handler of the guac_client to a finite number of seconds. If the free
 * handler does not complete within the time allotted, this function returns
 * and the intended free operation is left in an undefined state.
 *
 * @param client
 *     The guac_client instance to free.
 *
 * @param timeout
 *     The maximum amount of time to wait for the guac_client to be freed,
 *     in seconds.
 *
 * @return
 *     Zero if the guac_client was successfully freed within the time allotted,
 *     non-zero otherwise.
 */
static int guacd_timed_client_free(guac_client* client, int timeout) {

    pthread_t client_free_thread;

    guacd_client_free free_operation = {
        .client = client,
        .completed_cond = PTHREAD_COND_INITIALIZER,
        .completed_mutex = PTHREAD_MUTEX_INITIALIZER,
        .completed = 0
    };

    /* Get current time */
    struct timeval current_time;
    if (gettimeofday(&current_time, NULL))
        return 1;

    /* Calculate exact time that the free operation MUST complete by */
    struct timespec deadline = {
        .tv_sec  = current_time.tv_sec + timeout,
        .tv_nsec = current_time.tv_usec * 1000
    };

    /* The mutex associated with the pthread conditional and flag MUST be
     * acquired before attempting to wait for the condition */
    if (pthread_mutex_lock(&free_operation.completed_mutex))
        return 1;

    /* Free the client in a separate thread, so we can time the free operation */
    if (!pthread_create(&client_free_thread, NULL,
                guacd_client_free_thread, &free_operation)) {

        /* Wait a finite amount of time for the free operation to finish */
        (void) pthread_cond_timedwait(&free_operation.completed_cond,
                    &free_operation.completed_mutex, &deadline);
    }

    (void) pthread_mutex_unlock(&free_operation.completed_mutex);

    /* Return status of free operation */
    return !free_operation.completed;
}

/**
 * A reference to the current guacd process.
 */
guacd_proc* guacd_proc_self = NULL;

/**
 * A signal handler that will be invoked when a signal is caught telling this
 * guacd process to immediately exit.
 *
 * @param signal
 *     The signal that was received. Unused in this function since only
 *     signals that should result in stopping the proc should invoke this.
 */
static void signal_stop_handler(int signal) {

    /* Stop the current guacd proc */
    guacd_proc_stop(guacd_proc_self);

}

/**
 * Starts protocol-specific handling on the given process by loading the client
 * plugin for that protocol. This function does NOT return. It initializes the
 * process with protocol-specific handlers and then runs until the guacd_proc's
 * fd_socket is closed, adding any file descriptors received along fd_socket as
 * new users.
 *
 * @param proc
 *     The process that any new users received along fd_socket should be added
 *     to (after the process has been initialized for the given protocol).
 *
 * @param protocol
 *     The protocol to initialize the given process for.
 */
static void guacd_exec_proc(guacd_proc* proc, const char* protocol) {

    int result = 1;
   
    /* Set process group ID to match PID */ 
    if (setpgid(0, 0)) {
        guacd_log(GUAC_LOG_ERROR, "Cannot set PGID for connection process: %s",
                strerror(errno));
        goto cleanup_process;
    }

    /* Init client for selected protocol */
    guac_client* client = proc->client;
    if (guac_client_load_plugin(client, protocol)) {

        /* Log error */
        if (guac_error == GUAC_STATUS_NOT_FOUND)
            guacd_log(GUAC_LOG_WARNING,
                    "Support for protocol \"%s\" is not installed", protocol);
        else
            guacd_log_guac_error(GUAC_LOG_ERROR,
                    "Unable to load client plugin");

        goto cleanup_client;
    }

    /* The first file descriptor is the owner */
    int owner = 1;

    /* Enable keep alive on the broadcast socket */
    guac_socket_require_keep_alive(client->socket);

    guacd_proc_self = proc;

    /* Clean up and exit if SIGINT or SIGTERM signals are caught */
    struct sigaction signal_stop_action = { .sa_handler = signal_stop_handler };
    sigaction(SIGINT, &signal_stop_action, NULL);
    sigaction(SIGTERM, &signal_stop_action, NULL);

    /* Add each received file descriptor as a new user */
    int received_fd;
    while ((received_fd = guacd_recv_fd(proc->fd_socket)) != -1) {

        guacd_proc_add_user(proc, received_fd, owner);

        /* Future file descriptors are not owners */
        owner = 0;

    }
    
cleanup_client:

    /* Request client to stop/disconnect */
    guac_client_stop(client);

    /* Attempt to free client cleanly */
    guacd_log(GUAC_LOG_DEBUG, "Requesting termination of client...");
    result = guacd_timed_client_free(client, GUACD_CLIENT_FREE_TIMEOUT);

    /* If client was unable to be freed, warn and forcibly kill */
    if (result) {
        guacd_log(GUAC_LOG_WARNING, "Client did not terminate in a timely "
                "manner. Forcibly terminating client and any child "
                "processes.");
        guacd_kill_current_proc_group();
    }
    else
        guacd_log(GUAC_LOG_DEBUG, "Client terminated successfully.");

    /* Verify whether children were all properly reaped */
    pid_t child_pid;
    while ((child_pid = waitpid(0, NULL, WNOHANG)) > 0) {
        guacd_log(GUAC_LOG_DEBUG, "Automatically reaped unreaped "
                "(zombie) child process with PID %i.", child_pid);
    }

    /* If running children remain, warn and forcibly kill */
    if (child_pid == 0) {
        guacd_log(GUAC_LOG_WARNING, "Client reported successful termination, "
                "but child processes remain. Forcibly terminating client and "
                "child processes.");
        guacd_kill_current_proc_group();
    }

cleanup_process:

    /* Free up all internal resources outside the client */
    close(proc->fd_socket);
    guac_mem_free(proc);

    exit(result);

}

guacd_proc* guacd_create_proc(const char* protocol) {

    int sockets[2];

    /* Open UNIX socket pair */
    if (socketpair(AF_UNIX, SOCK_DGRAM, 0, sockets) < 0) {
        guacd_log(GUAC_LOG_ERROR, "Error opening socket pair: %s", strerror(errno));
        return NULL;
    }

    int parent_socket = sockets[0];
    int child_socket = sockets[1];

    /* Allocate process */
    guacd_proc* proc = guac_mem_zalloc(sizeof(guacd_proc));
    if (proc == NULL) {
        close(parent_socket);
        close(child_socket);
        return NULL;
    }

    /* Associate new client */
    proc->client = guac_client_alloc();
    if (proc->client == NULL) {
        guacd_log_guac_error(GUAC_LOG_ERROR, "Unable to create client");
        close(parent_socket);
        close(child_socket);
        guac_mem_free(proc);
        return NULL;
    }

    /* Init logging */
    proc->client->log_handler = guacd_client_log;

    /* Fork */
    proc->pid = fork();
    if (proc->pid < 0) {
        guacd_log(GUAC_LOG_ERROR, "Cannot fork child process: %s", strerror(errno));
        close(parent_socket);
        close(child_socket);
        guac_client_free(proc->client);
        guac_mem_free(proc);
        return NULL;
    }

    /* Child */
    else if (proc->pid == 0) {

        /* Communicate with parent */
        proc->fd_socket = parent_socket;
        close(child_socket);

        /* Start protocol-specific handling */
        guacd_exec_proc(proc, protocol);

    }

    /* Parent */
    else {

        /* Communicate with child */
        proc->fd_socket = child_socket;
        close(parent_socket);

    }

    return proc;

}

/**
 * Kill the provided child guacd process. This function must be called by the
 * parent process, and will block until all processes associated with the
 * child process have terminated.
 *
 * @param proc
 *     The child guacd process to kill.
 */
static void guacd_proc_kill(guacd_proc* proc) {

    /* Request orderly termination of process */
    if (kill(proc->pid, SIGTERM))
        guacd_log(GUAC_LOG_DEBUG, "Unable to request termination of "
                "client process: %s ", strerror(errno));

    /* Wait for all processes within process group to terminate */
    pid_t child_pid;
    while ((child_pid = waitpid(-proc->pid, NULL, 0)) > 0 || errno == EINTR) {
        guacd_log(GUAC_LOG_DEBUG, "Child process %i of connection \"%s\" has terminated",
            child_pid, proc->client->connection_id);
    }

    guacd_log(GUAC_LOG_DEBUG, "All child processes for connection \"%s\" have been terminated.",
        proc->client->connection_id);

}

void guacd_proc_stop(guacd_proc* proc) {

    /* A non-zero PID means that this is the parent process */
    if (proc->pid != 0) {
        guacd_proc_kill(proc);
        return;
    }

    /* Otherwise, this is the child process */

    /* Signal client to stop */
    guac_client_stop(proc->client);

    /* Shutdown socket - in-progress recvmsg() will not fail otherwise */
    if (shutdown(proc->fd_socket, SHUT_RDWR) == -1)
        guacd_log(GUAC_LOG_ERROR, "Unable to shutdown internal socket for "
                "connection %s. Corresponding process may remain running but "
                "inactive.", proc->client->connection_id);

    /* Clean up our end of the socket */
    close(proc->fd_socket);

}
