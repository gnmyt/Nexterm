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

#ifndef GUAC_RDP_PRINT_JOB_H
#define GUAC_RDP_PRINT_JOB_H

#include <guacamole/client.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <unistd.h>

/**
 * The maximum number of bytes in the filename of an RDP print job sent as a
 * file over the Guacamole protocol, including NULL terminator.
 */
#define GUAC_RDP_PRINT_JOB_FILENAME_MAX_LENGTH 1024

/**
 * The default filename to use for the PDF output of an RDP print job if no
 * document title can be found within the printed data.
 */
#define GUAC_RDP_PRINT_JOB_DEFAULT_FILENAME "guacamole-print.pdf"

/**
 * The maximum number of bytes to search through at the beginning of a
 * PostScript document when locating the document title.
 */
#define GUAC_RDP_PRINT_JOB_TITLE_SEARCH_LENGTH 2048

/**
 * The current state of an RDP print job.
 */
typedef enum guac_rdp_print_job_state {

    /**
     * The print stream has been opened with the Guacamole client, but the
     * client has not yet confirmed that it is ready to receive data.
     */
    GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK,

    /**
     * The print stream has been opened with the Guacamole client, and the
     * client has responded with an "ack", confirming that it is ready to
     * receive data (or that data has been received and it is ready to receive
     * more).
     */
    GUAC_RDP_PRINT_JOB_ACK_RECEIVED,

    /**
     * The print stream has been closed or the printer is terminating, and no
     * further data should be sent to the client.
     */
    GUAC_RDP_PRINT_JOB_CLOSED

} guac_rdp_print_job_state;

/**
 * Data specific to an instance of the printer device.
 */
typedef struct guac_rdp_print_job {

    /**
     * The Guacamole client associated with the RDP session.
     */
    guac_client* client;

    /**
     * The user receiving the output from the print job.
     */
    guac_user* user;

    /**
     * The stream along which the print job output should be sent.
     */
    guac_stream* stream;

    /**
     * The PID of the print filter process converting PostScript data into PDF.
     */
    pid_t filter_pid;

    /**
     * The filename that should be used when the converted PDF output is
     * streamed to the Guacamole user. This value will be automatically
     * determined based on the contents of the printed document.
     */
    char filename[GUAC_RDP_PRINT_JOB_FILENAME_MAX_LENGTH];

    /**
     * File descriptor that should be written to when sending documents to the
     * printer.
     */
    int input_fd;

    /**
     * File descriptor that should be read from when receiving output from the
     * printer.
     */
    int output_fd;

    /**
     * The current state of the print stream, dependent on whether the client
     * has acknowledged creation of the stream, whether the client has
     * acknowledged receipt of data along the steam, and whether the print
     * stream itself has closed.
     */
    guac_rdp_print_job_state state;

    /**
     * Lock which is acquired prior to modifying the state property or waiting
     * on the state_modified conditional.
     */
    pthread_mutex_t state_lock;

    /**
     * Conditional which signals modification to the state property of this
     * structure.
     */
    pthread_cond_t state_modified;

    /**
     * Thread which transfers data from the printer to the Guacamole client.
     */
    pthread_t output_thread;

    /**
     * The number of bytes received in the current print job.
     */
    int bytes_received;

} guac_rdp_print_job;

/**
 * A blob of print data being sent to the Guacamole user.
 */
typedef struct guac_rdp_print_blob {

    /**
     * The print job which generated the data being sent.
     */
    guac_rdp_print_job* job;

    /**
     * The data being sent.
     */
    void* buffer;

    /**
     * The number of bytes of data being sent.
     */
    int length;

} guac_rdp_print_blob;

/**
 * Allocates a new print job for the given user. It is expected that this
 * function will be invoked via a call to guac_client_for_user() or
 * guac_client_for_owner().
 *
 * @param user
 *     The user that should receive the output from the print job.
 *
 * @param data
 *     An arbitrary data parameter required by guac_client_for_user() and
 *     guac_client_for_owner() but ignored by this function. This should
 *     always be NULL.
 *
 * @return
 *     A pointer to a newly-allocated guac_rdp_print_job, or NULL if the
 *     print job could not be created.
 */
void* guac_rdp_print_job_alloc(guac_user* user, void* data);

/**
 * Writes PostScript print data to the given active print job. The print job
 * will automatically convert this data to PDF, streaming the result to the
 * Guacamole user associated with the print job. This function may block if
 * the print job is not yet ready for more data.
 *
 * @param job
 *     The print job to write to.
 *
 * @param buffer
 *     The PostScript print data to write to the given print job.
 *
 * @param length
 *     The number of bytes of PostScript print data to write.
 *
 * @return
 *     The number of bytes written, or -1 if an error occurs which prevents
 *     further writes.
 */
int guac_rdp_print_job_write(guac_rdp_print_job* job,
        void* buffer, int length);

/**
 * Frees the memory associated with the given print job, closing all underlying
 * file descriptors, and ending the file transfer to the associated Guacamole
 * user. This function may block if the print filter process has not yet
 * finished processing the received data.
 *
 * @param job
 *     The print job to free.
 */
void guac_rdp_print_job_free(guac_rdp_print_job* job);

/**
 * Forcibly kills the given print job, stopping all associated processing and
 * streaming. The memory associated with the print job will still need to be
 * reclaimed via guac_rdp_print_job_free().
 *
 * @param job
 *     The print job to kill.
 */
void guac_rdp_print_job_kill(guac_rdp_print_job* job);

#endif

